import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import { sanitize } from "entitystorage"
import { default as fileService, tokens } from "../../services/file.mjs"
import Archiver from 'archiver';
import moment from "moment"
import { validateAccess, noGuest } from "../../../../services/auth.mjs"
import File from "../../models/file.mjs";
import Folder from "../../models/folder.mjs";
import FileOrFolder from "../../models/fileorfolder.mjs";
import Share from "../../../../models/share.mjs";

export default (app) => {

  const route = Router();
  app.use("/file", route)

  route.get("/searchhelp", (req, res) => {
    res.json(tokens)
  })

  route.get("/tag/:tag", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let results = FileOrFolder.allByTag(sanitize(req.params.tag))
      .filter(f => f.hasAccess(res.locals.user, 'r', res.locals))
      .map(c => c.toObj(res.locals.user, res.locals.shareKey))
    res.json(results)
  })

  route.get("/path", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    Folder.userRoot(res.locals.user) //Will create user root if missing
    res.json(Folder.root().toObj(res.locals.user, res.locals.shareKey))
  })

  route.get("/path/*", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let path = decodeURI(req.path.substring(5))
    Folder.userRoot(res.locals.user) //Will create user root if missing
    let folder = path.substring(1).split("/").reduce((parent, name) => {
      return parent?.getChildFolderNamed(name) || null
    }, Folder.root())
    if(folder && !folder.validateAccess(res, 'r')) return;
    res.json(folder?.toObj(res.locals.user, res.locals.shareKey) || null)
  })

  route.get("/query", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    res.json(fileService.search(req.query.filter).results
      .filter(f => f.hasAccess(res.locals.user, 'r'))
      .map(r => r.toObj(res.locals.user, res.locals.shareKey)))
  })

  route.post("/tag/:tag/upload", noGuest, (req, res, next) => {
    if (!validateAccess(req, res, { permission: "file.upload" })) return;
    let files = []
    for (let filedef in req.files) {
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      for (let f of fileObj) {
        let file = new File({ ...f, tag: req.params.tag, owner: res.locals.user })
        files.push({ id: file._id, hash: file.hash })
      }
    }
    res.json(files)
  })

  route.post(["/drop", "/drop/shared"], noGuest, (req, res, next) => {
    if (!validateAccess(req, res, { permission: "file.upload" })) return;
    let expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 30)
    let files = []
    for (let filedef in req.files) {
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      for (let f of fileObj) {
        let file = new File({ ...f, tag: "drop", expire: expirationDate.toISOString(), owner: res.locals.user })
        file.acl = req.path.endsWith("/shared") ? "r:shared;w:shared" : "r:private;w:private"
        file.shareKey = new Share("drop", 'r', res.locals.user).attach(file).key;
        files.push({ id: file._id, hash: file.hash })
      }
    }
    res.json(files)
  })

  route.delete("/drop/all", noGuest, (req, res, next) => {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    FileOrFolder.allByTag("drop")
      .filter(f => f.hasAccess(res.locals.user, 'w'))
      .forEach(f => f.delete())
    res.json({ success: true })
  })

  route.get("/drop", noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let results = FileOrFolder.allByTag("drop")
                              .filter(f => f.hasAccess(res.locals.user, 'r', res.locals))
                              .map(c => ({
                                ...c.toObj(res.locals.user, res.locals.shareKey), 
                                dropLink: `${global.sitecore.apiURL}/file/raw/${c._id}${c.name ? `/${encodeURI(c.name)}` : ''}?shareKey=${c.shareKey}`
                              }))
    res.json(results)
  })

  route.post("/folder/:id/upload", (req, res, next) => {
    if (!validateAccess(req, res, { permission: "file.upload" })) return;
    let folder = Folder.lookup(sanitize(req.params.id))
    if (!folder) throw "Unknown folder"
    if (!folder.validateAccess(res, 'w')) return;
    let files = []
    for (let filedef in req.files) {
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      for (let f of fileObj) {
        let origName = f.name
        let i = 1;
        while (folder.hasChildNamed(f.name)){
          f.name = origName.includes(".") ? `${origName.split(".").slice(0, -1).join(".")}-${++i}.${origName.split(".").slice(-1)}` : `${origName}-${++i}`
        }
        let file = new File({
          ...f,
          tag: req.query.tag || null,
          tags: req.query.tags?.split(",").map(t => t.trim()) || null,
          owner: res.locals.user,
          folder
        })
        files.push({ id: file._id, hash: file.hash })
      }
    }
    res.json(files)
  })

  route.post("/upload-basic", noGuest, function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.upload" })) return;
    if (!req.query.tags) throw "Tags in the query are mandatory"
    if (!req.query.hash) throw "Must provide hash in query";
    let f = { name: req.query.name || "file", size: parseInt(req.header("Content-Length")), hash: req.query.hash, mimetype: req.query.mime || "application/x-binary", data: req }
    let file = new File({ ...f, tags: req.query.tags?.split(",").map(t => t.trim() || []), owner: res.locals.user })
    res.json({ id: file._id, hash: file.hash, name: f.name })
  })

  route.post("/:id/folders", function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    if (!sanitize(req.body.name)) throw "name is mandatory"
    if (!req.params.id || isNaN(req.params.id)) throw "Parent folder is mandatory"
    let parent = Folder.lookup(sanitize(req.params.id))
    if (!parent) throw "Parent doesn't exist";
    if (!parent.validateAccess(res, 'w')) return;
    if (parent.hasChildNamed(sanitize(req.body.name))) throw "A file or folder with that name already exists"
    let child = new Folder(req.body.name, res.locals.user, parent)
    res.json(child.toObj(res.locals.user, res.locals.shareKey))
  })

  route.get(['/dl/:id', '/dl/:id/:filename', '/download/:id', '/download/:id/:filename'], function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let file = File.lookupAccessible(sanitize(req.params.id), res.locals.user, res.locals.shareKey)
    if (!file) throw "Unknown file";

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });

  route.get(['/raw/:id', '/raw/:id/:filename'], function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let file = File.lookupAccessible(sanitize(req.params.id), res.locals.user, res.locals.shareKey)
    if (!file) throw "Unknown file";

    res.setHeader('Content-disposition', `inline; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });

  route.get('/query/dl', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let files = fileService.search(req.query.filter).results
                           .filter(f => !f.tags.includes("folder") && f.hasAccess(res.locals.user, 'r'))
    if (files.length < 1) throw "No files in filter";
    let zip = Archiver('zip');
    for (let file of files) {
      zip.append(file.blob, { name: file.name })
    }
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-disposition': `attachment; filename=files_${moment().format("YYYY-MM-DD HH:mm:ss")}.zip`
    });
    zip.pipe(res)
    zip.finalize()
  });

  route.delete('/query', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    let files = fileService.search(req.query.filter)
    if (files.results.length < 1) return res.json(true);

    for (let file of files.results) {
      if(!file.hasAccess(res.locals.user, 'w')) continue;
      file.delete()
    }
    res.json(true);
  });

  route.patch('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    let file = FileOrFolder.lookup(sanitize(req.params.id))?.toType()
    if (!file) throw "Unknown file or folder"
    if(!file.validateAccess(res, 'w')) return;

    if (req.body.name !== undefined && req.body.name) {
      file.name = req.body.name
      if(file instanceof File)
        file.updateMime()
    }
    if (req.body.filename !== undefined && req.body.filename) file.name = req.body.filename

    let tagList = !req.body.tags ? null : Array.isArray(req.body.tags) ? req.body.tags : typeof req.body.tags === "string" ? req.body.tags.split(",").map(t => t.trim()) : null;
    if (tagList) {
      tagList = tagList.map(t => `user-${t}`)
      for (let t of file.tags.filter(t => t.startsWith("user-") && !tagList.includes(t)))
        file.removeTag(t)
      file.tag(tagList)
    }
    res.json(true)
  })

  route.post('/:id/tags', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    let file = FileOrFolder.lookup(sanitize(req.params.id))
    if (!file) throw "Unknown file"
    if(!file.validateAccess(res, 'w')) return;
    let tags = req.body.tag ? [req.body.tag] : (req.body.tags && Array.isArray(req.body.tags)) ? req.body.tags : []
    for (let tag of tags) {
      if (typeof tag !== "string") continue;
      file.tag(`user-${tag}`)
    }
    res.json(true)
  })

  route.delete('/:id/tags/:tag', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    let file = FileOrFolder.lookup(sanitize(req.params.id))
    if (!file) throw "Unknown file"
    if (!req.params.tag) throw "No tag provided"
    if(!file.validateAccess(res, 'w')) return;

    file.removeTag(`user-${req.params.tag}`)

    res.json(true)
  })

  route.delete('/:id', function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.edit" })) return;
    let file = FileOrFolder.lookup(sanitize(req.params.id))
    if (!file) throw "Unknown file"
    if(!file.validateAccess(res, 'w')) return;
    file.delete();

    res.json(true)
  })

  route.get('/:id', async function (req, res, next) {
    if (!validateAccess(req, res, { permission: "file.read" })) return;
    let file = FileOrFolder.lookupAccessible(sanitize(req.params.id), res.locals.user, res.locals.shareKey)
    if (!file) return res.sendStatus(404);
    res.json(file.toObj(res.locals.user, res.locals.shareKey));
  })
};