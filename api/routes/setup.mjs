import express from "express"
import Role from "../../../../models/role.mjs";
import User from "../../../../models/user.mjs";
const { Router, Request, Response } = express;
const route = Router();
import { lookupType, permission } from "../../../../services/auth.mjs"
import Setup from "../../models/setup.mjs";

export default (app) => {

  app.use("/files", route)

  route.get('/setup/users', permission("files.setup"), (req, res, next) => {
    res.json(User.active().map(user => ({
      ...user.toObjSimple(),
      quotaMB: Setup.userQuotaMB(user),
      usageMB: Setup.userUsageMB(user)
    })))
  });

  route.get('/setup', permission("files.setup"), (req, res, next) => {
    res.json(Setup.lookup().toObj());
  });

  route.patch('/setup/role/:id', permission("files.setup"), lookupType(Role, "role"), (req, res, next) => {
    if(req.body.quota !== null && isNaN(req.body.quota)) throw "Invalid quota value";
    res.locals.role.fileQuota = req.body.quota;
    res.json(true);
  });

  route.patch('/setup', permission("files.setup"), (req, res, next) => {
    Setup.lookup().patch(req.body);
    res.json(true);
  });
};