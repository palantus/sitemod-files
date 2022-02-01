import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity, {sanitize} from "entitystorage";
import { findDangerousChanges } from "graphql";
import {validateAccess} from "../../../../services/auth.mjs"

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
};