import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity, {sanitize} from "entitystorage";
import {validateAccess} from "../../../../services/auth.mjs"
import service from "../../services/filesource.mjs"
import fetch from 'node-fetch'
import {service as userService} from "../../../../services/user.mjs"

export default (app) => {

  const route = Router();
  app.use("/filesource", route)

  let toObj = fs => (fs ? { id: fs._id, title: fs.title, existsUrl: fs.existsUrl || null, downloadUrl: fs.downloadUrl, detailsUrl: fs.detailsUrl || null, apiKeyParm: fs.apiKeyParm || null } : null)

  route.get('/', function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    res.json(Entity.search("tag:filesource").map(toObj));
  });
  route.get('/:id', function (req, res, next) {
    if (!req.params.id) { res.sendStatus(404); return; }
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    res.json(toObj(Entity.find(`tag:filesource id:"${sanitize(req.params.id)}"`)));
  });

  route.post('/', function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    if (!req.body.title || !req.body.downloadUrl)
      throw "title and downloadUrl are mandatory for file sources"
    let e = new Entity()
    e.title = req.body.title
    e.existsUrl = req.body.existsUrl || null
    e.downloadUrl = req.body.downloadUrl
    e.detailsUrl = req.body.detailsUrl || null
    e.apiKeyParm = req.body.apiKeyParm || null
    e.tag("filesource")
    res.json(toObj(e));
  });

  route.patch('/:id', function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    let e = Entity.find(`tag:filesource id:"${sanitize(req.params.id)}"`)
    if (!e) { res.sendStatus(404); return; }

    if (req.body.title) e.title = req.body.title
    if (req.body.existsUrl) e.existsUrl = req.body.existsUrl
    if (req.body.downloadUrl) e.downloadUrl = req.body.downloadUrl
    if (req.body.detailsUrl) e.detailsUrl = req.body.detailsUrl
    if (req.body.apiKeyParm) e.apiKeyParm = req.body.apiKeyParm
    res.json(toObj(e));
  });

  route.delete('/:id', function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    let e = Entity.find(`tag:filesource id:"${sanitize(req.params.id)}"`)
    if (!e) { res.sendStatus(404); return; }
    e.delete();
    res.json(true);
  });

  route.get(['/download/:id', '/download/:id/:filename'], async function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.read"})) return;

    try {
      // First check local files
      let id = sanitize(req.params.id)
      let file = Entity.find(`(id:${id}|prop:"hash=${id}") tag:file !tag:folder`)
      if (file) {
        res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
        res.setHeader('Content-Type', file.mime);
        res.setHeader('Content-Length', file.size);
        file.blob.pipe(res)
        return;
      }

      // Then check all file sources
      file = await service.findFile(id)
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
      
    } catch(err){
      console.log(err)
      res.status(501).json({success: false, error: "Server failure"})
    }
  });

  route.get('/check/:id', async function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.source.manage"})) return;
    try{
      res.json(await service.findFileAll(sanitize(req.params.id)))
    } catch(err){
      console.log(err)
      res.status(501).json({success: false, error: "Server failure"})
    }
  });

  route.get('/file/:id', async function (req, res, next) {
    if(!validateAccess(req, res, {permission: "file.read"})) return;

    let file;
    try{
      file = await service.findFile(sanitize(req.params.id))
    } catch(err){
      console.log(err)
    }
    
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
        download: `${global.sitecore.apiURL}/file/download/${file.id}${filename ? `/${encodeURI(filename)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
        raw: `${global.sitecore.apiURL}/file/raw/${file.id}${filename ? `/${encodeURI(filename)}` : ''}?token=${userService.getTempAuthToken(res.locals.user)}`,
      },
      fileSource: {
        id: src._id,
        title: src.title
      }
    })
  });
};