import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import Entity from "entitystorage";
import { findDangerousChanges } from "graphql";

export default (app) => {

  const route = Router();
  app.use("/filesource", route)

  let toObj = fs => (fs ? { id: fs._id, title: fs.title, existsUrl: fs.existsUrl || null, downloadUrl: fs.downloadUrl, detailsUrl: fs.detailsUrl || null, apiKeyParm: fs.apiKeyParm || null } : null)

  route.get('/', async function (req, res, next) {
    res.json(Entity.search("tag:filesource").map(toObj));
  });
  route.get('/:id', async function (req, res, next) {
    if (!req.params.id) { res.sendStatus(404); return; }
    res.json(toObj(Entity.find(`tag:filesource id:${req.params.id}`)));
  });

  route.post('/', async function (req, res, next) {
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

  route.patch('/:id', async function (req, res, next) {
    let e = Entity.find(`tag:filesource id:${req.params.id}`)
    if (!e) { res.sendStatus(404); return; }

    if (req.body.title) e.title = req.body.title
    if (req.body.existsUrl) e.existsUrl = req.body.existsUrl
    if (req.body.downloadUrl) e.downloadUrl = req.body.downloadUrl
    if (req.body.detailsUrl) e.detailsUrl = req.body.detailsUrl
    if (req.body.apiKeyParm) e.apiKeyParm = req.body.apiKeyParm
    res.json(toObj(e));
  });

  route.delete('/:id', async function (req, res, next) {
    let e = Entity.find(`tag:filesource id:${req.params.id}`)
    if (!e) { res.sendStatus(404); return; }
    e.delete();
    res.json(true);
  });
};