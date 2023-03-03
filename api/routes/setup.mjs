import express from "express"
const { Router, Request, Response } = express;
const route = Router();
import { permission } from "../../../../services/auth.mjs"
import Setup from "../../models/setup.mjs";

export default (app) => {

  app.use("/files", route)

  route.get('/setup', permission("files.setup"), (req, res, next) => {
    res.json(Setup.lookup().toObj());
  });

  route.patch('/setup', permission("files.setup"), (req, res, next) => {
    Setup.lookup().patch(req.body);
    res.json(true);
  });
};