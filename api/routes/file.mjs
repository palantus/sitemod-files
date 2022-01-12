import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity from "entitystorage"
import service from "../../services/filesource.mjs"
import fetch from 'node-fetch'
import { axmURL } from "../../../../api/routes/auth.mjs";
import { getTimestamp } from "../../../../tools/date.mjs"
import {default as fileService, tokens} from "../../services/file.mjs"
import Archiver from 'archiver';
import moment from "moment"
import {service as userService} from "../../../../services/user.mjs"
import {validateAccess} from "../../../../services/auth.mjs"
import {config} from "../../../../loaders/express.mjs"

export default (app) => {

  const route = Router();
  app.use("/file", route)

  route.get("/searchhelp", (req, res) => {
    res.json(tokens)
  })

  route.get(['/download/:id', '/download/:id/:filename'], async function (req, res, next) {

    // First check local files
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file !tag:folder`)
    if (file) {
      res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
      res.setHeader('Content-Type', file.mime);
      res.setHeader('Content-Length', file.size);
      file.blob.pipe(res)
      return;
    }

    // Then check all file sources
    file = await service.findFile(req.params.id)
    if (!file) {
      res.sendStatus(404);
      return;
    }
    let filename = file.details?.result?.filename || file.details?.filename || null
    let src = Entity.find(`tag:filesource id:${file.fileSource.id}`)
    let downloadUrl = src.downloadUrl.replace("$hash$", file.id);
    let url = service.applyApiKeyParm(downloadUrl, Entity.find(`tag:filesource id:${src._id}`).apiKeyParm)

    let r = await fetch(url, { headers: { 'Origin': req.header("Origin") } })
    res.writeHead(200, {
      "Content-Disposition": r.headers.get("Content-Disposition"),
      'Content-Type': r.headers.get("Content-Type"),
      'Content-Length': r.headers.get("Content-Length")
    })
    r.body.pipe(res)
  });

  route.get("/tag/:tag", function (req, res, next) {
    let items = Entity.search(`tag:file tag:"user-${req.params.tag}"`)
    res.json(items.map(i => ({
      id: i._id,
      type: i.tags.includes("folder") ? "folder" : "file",
      filename: i.name,
      size: i.size || null,
      hash: i.hash || null,
      mime: i.mime || null,
      tags: i.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5))
    })))
  })

  route.get("/query", async function (req, res, next) {
    let result = await fileService.search(req.query.filter)
    res.json({
      tags: result.tags,
      results: result.results.map(i => ({
        id: i._id,
        type: i.tags.includes("folder") ? "folder" : "file",
        filename: i.name,
        size: i.size || null,
        hash: i.hash || null,
        mime: i.mime || null,
        tags: i.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5)),
        filter: i.filter
      }))})
  })

  route.post("/tag/:tag/upload", function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let files = []
    for (let filedef in req.files) {
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      for (let f of fileObj) {
        let file = new Entity().tag("file")
          .prop("name", f.name)
          .prop("size", f.size)
          .prop("hash", f.md5)
          .prop("mime", f.mimetype)
          .prop("timestamp", getTimestamp())
          .tag(`user-${req.params.tag}`)
          .setBlob(f.data)

        files.push({id: file._id, hash: file.hash})
      }
    }
    res.json(files)
  })

  route.post("/upload-single", function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    if(!req.query.tags) throw "Tags in the query are mandatory"
    
    let f = null;
    if(req.files){
      if(Object.keys(req.files).length < 1) throw "No file sent"
      
      let filedef = Object.keys(req.files)[0]
      let fileObj = Array.isArray(req.files[filedef]) ? req.files[filedef] : [req.files[filedef]]
      if(fileObj.length < 1) throw "No files in obj"
      f = fileObj[0]
    } else if(req.query.hash){
      f = {name: "file", size: parseInt(req.header("Content-Length")), md5: req.query.hash, mimetype: req.query.mime || "application/x-binary", data: req}
    }

    if(!f) throw "Invalid file"

    let file = new Entity().tag("file")
      .prop("name", f.name)
      .prop("size", f.size)
      .prop("hash", f.md5)
      .prop("mime", f.mimetype)
      .prop("timestamp", getTimestamp())
      .tag(req.query.tags.split(",").map(t => `user-${t}`))
      .setBlob(f.data)

      res.json({
        id: file._id, 
        hash: file.hash,
        filename: f.name,
        downloadUrl: `${config().apiURL}/file/download/${file._id}${file.name ? `/${encodeURI(file.name)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`
      })
  })

  route.post("/:id/folders", function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    if (!req.body.name) throw "name is mandatory"
    let parent = req.params.id != "root" ? Entity.find(`id:${req.params.id} tag:file`) : null
    let child = new Entity().tag("file")
      .tag("folder")
      .prop("name", req.body.name)
      .prop("filter", req.body.filter || null)
      .rel(parent, "parent");
    if (parent) {
      parent.rel(child, "child")
    }
    res.json(true)
  })

  route.get(['/dl/:id', '/dl/:id/:filename'], function (req, res, next) {
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file !tag:folder`)
    if (!file) throw "Unknown file";

    res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });

  route.get(['/raw/:id', '/raw/:id/:filename'], async function (req, res, next) {
    let file = Entity.find(`id:${req.params.id} tag:file !tag:folder`)
    if (!file) throw "Unknown file";

    res.setHeader('Content-disposition', `inline; filename=${file.name}`);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);

    file.blob.pipe(res)
  });

  route.get('/query/dl', async function (req, res, next) {
    let files = (await fileService.search(req.query.filter)).results.filter(f => !f.tags.includes("folder"))
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

  route.delete('/query', async function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let files = await fileService.search(req.query.filter)
    if (files.results.length < 1) return res.json(true);

    for (let file of files.results) {
      file.delete()
    }
    res.json(true);
  });

  route.patch('/:id', function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file`)
    if(!file) throw "Unknown file"

    if(req.body.name !== undefined && req.body.name) file.name = req.body.name
    if(req.body.filename !== undefined && req.body.filename) file.name = req.body.filename
    if(req.body.filter !== undefined) file.filter = req.body.filter || ""

    let tagList = !req.body.tags ? null : Array.isArray(req.body.tags) ? req.body.tags : typeof req.body.tags === "string" ? req.body.tags.split(",").map(t => t.trim()) : null;
    if(tagList){
      tagList = tagList.map(t => `user-${t}`)
      for(let t of file.tags.filter(t => t.startsWith("user-") && !tagList.includes(t))) 
        file.removeTag(t)
      file.tag(tagList)
    }
    res.json(true)
  })

  route.post('/:id/tags', function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file !tag:folder`)
    if(!file) throw "Unknown file"
    if(!req.body.tag) throw "No tag provided"

    file.tag(`user-${req.body.tag}`)

    res.json(true)
  })

  route.delete('/:id/tags/:tag', function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file !tag:folder`)
    if(!file) throw "Unknown file"
    if(!req.params.tag) throw "No tag provided"

    file.removeTag(`user-${req.params.tag}`)

    res.json(true)
  })

  route.delete('/:id', function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file`)
    if(!file) throw "Unknown file"
    file.delete();

    res.json(true)
  })

  route.get('/:id', async function (req, res, next) {
    let file = Entity.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:file`)
    if (file) {
      res.json({
        id: file._id,
        type: file.tags.includes("folder") ? "folder" : "file",
        filename: file.name,
        size: file.size || null,
        hash: file.hash || null,
        mime: file.mime || null,
        tags: file.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5)),
        links: {
          download: `${config().apiURL}/file/download/${file._id}${file.name ? `/${encodeURI(file.name)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
          raw: `${config().apiURL}/file/raw/${file._id}${file.name ? `/${encodeURI(file.name)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
        }
      });
      return;
    }

    file = await service.findFile(req.params.id)
    if (!file) {
      res.sendStatus(404);
      return;
    }

    let src = Entity.find(`tag:filesource id:${file.fileSource.id}`)
    let filename = file.details?.result?.filename || file.details?.filename || null
    res.json({
      id: file.id,
      hash: req.params.id,
      filename: filename || "Unknown_filename",
      size: file.details?.result?.size || file.details?.size || null,
      links: {
        download: `${config().apiURL}/file/download/${file.id}${filename ? `/${encodeURI(filename)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
        raw: `${config().apiURL}/file/raw/${file.id}${filename ? `/${encodeURI(filename)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
      },
      fileSource: {
        id: src._id,
        title: src.title
      }
    })
  });

  route.get('/check/:id', async function (req, res, next) {
    if(!validateAccess(req, res, {role: "team"})) return;
    res.json(await service.findFileAll(req.params.id))
  });
};