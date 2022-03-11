import { ResourceType, v2 as webdav } from 'webdav-server';
import User from "../../../../models/user.mjs"
import { sanitize } from 'entitystorage';
import FileOrFolder from '../../models/fileorfolder.mjs';
import File from '../../models/file.mjs';
import Folder from '../../models/folder.mjs';

export default (route, app) => {
  const userManager = new DavUserManager();
  const privilegeManager = new DavPrivilegeManager();
  const server = new webdav.WebDAVServer({
    httpAuthentication: new DavHTTPBasicAuthentication(userManager, 'realm'),
    privilegeManager: privilegeManager,
    requireAuthentification: true
  });
  server.setFileSystem('/', new DavFileSystem())

  app.use(/*(req, res, next) => {
    console.log(req.method, req.url)
    next()
  }, */webdav.extensions.express('/webdav/files', server));
}

class DavHTTPBasicAuthentication {
  constructor(userManager, realm = 'realm') {
    this.userManager = userManager
    this.realm = realm
  }

  askForAuthentication(ctx) {
    return {
      'WWW-Authenticate': 'Basic realm="' + this.realm + '"'
    }
  }

  getUser(ctx, callback) {
    const onError = (error) => {
      this.userManager.getDefaultUser((defaultUser) => {
        callback(error, defaultUser)
      })
    }

    const authHeader = ctx.headers.find('Authorization')
    if (!authHeader) {
      onError(webdav.Errors.MissingAuthorisationHeader)
      return;
    }
    if (!/^Basic \s*[a-zA-Z0-9]+=*\s*$/.test(authHeader)) {
      onError(webdav.Errors.WrongHeaderFormat);
      return;
    }

    const value = Buffer.from(/^Basic \s*([a-zA-Z0-9]+=*)\s*$/.exec(authHeader)[1], 'base64').toString().split(':', 2);
    const username = sanitize(value[0]);
    const password = value[1];

    this.userManager.getUserByNamePassword(username, password, (e, user) => {
      if (e){
        console.log(e)
        onError(webdav.Errors.BadAuthentication);
      } else {
        callback(null, user);
      }
    });
  }
}

class DavUser {
  constructor(user) {
    this.user = user
  }

  get uid() {
    return this.user.id
  }

  get isAdministrator() {
    return this.user.permissions.includes("admin")
  }

  get isDefaultUser() {
    return this.user.id == "guest"
  }

  get password() {
    return ''
  }

  get username() {
    return this.user.id
  }
}

class DavUserManager {
  getUserByName(name, callback) {
    let user = User.lookup(name)
    if (!user){
      console.log(`Webdav error: User '${name}' not found`)
      callback(webdav.Errors.UserNotFound);
    }
    else
      callback(null, new DavUser(user));
  }

  getDefaultUser(callback) {
    let user = User.lookup("guest")
    callback(new DavUser(user));
  }

  addUser(name, password, isAdmin = false) {
    return null; //Never supported
  }

  getUsers(callback) {
    callback(null, User.all().map(u => new DavUser(u)));
  }

  getUserByNamePassword(name, password, callback) {
    let user = User.lookup(name)
    if (user && user.active && user.hasPassword() && user.validatePassword(password))
      callback(null, new DavUser(user));
    else {
      console.log(`Webdav error: User '${name}' not found with matching password`)
      callback(webdav.Errors.UserNotFound);
    }
  }
}

/* PrivilegeManager */

export class DavPrivilegeManager extends webdav.PrivilegeManager {
  getRights(user, path) {
    let file = FileOrFolder.lookupByPath(path.toString())
    if (!file)
      file = Folder.lookupByPath(path.getParent()?.toString())
    if(!file)
      return [];

    if (file.hasAccess(user.user, 'r')) {
      if (file.hasAccess(user.user, 'w')) {
        //console.log(user.user.id, path.toString(), "w")
        return [
          'canRead',
          'canReadLocks',
          'canReadContent',
          'canReadProperties',
          'canReadContentTranslated',
          'canReadContentSource',
          'canWrite',
          'canWriteLocks',
          'canWriteContent',
          'canWriteProperties',
          'canWriteContentTranslated',
          'canWriteContentSource'
        ]
      } else {
        //console.log(user.user.id, path.toString(), "r")
        return [
          'canRead',
          'canReadLocks',
          'canReadContent',
          'canReadProperties',
          'canReadContentTranslated',
          'canReadContentSource',
        ]
      }
    }
    //console.log(user.user.id, path.toString(), "NONE")
    return []
  }

  _can(fullPath, user, resource, privilege, callback) {
    if (!user)
      return callback(null, false);

    const rights = this.getRights(user, fullPath);
    const can = !!rights && rights.some((r) => r === 'all' || r === privilege);
    callback(null, can);
  }
}

export class DavFileSystem extends webdav.FileSystem {

  static lockManagers = new Map()
  static propertyManagers = new Map()

  _fastExistCheck(ctx, path, callback) {
    callback((path && path.toString()) ? !!FileOrFolder.lookupByPath(path.toString()) : true);
  }

  _create(path, ctx, callback) {
    let parent = Folder.lookupByPath(path.getParent().toString())
    if(!parent) return callback(webdav.Errors.ResourceNotFound);
    if (!parent.hasAccess(ctx.context.user.user, 'w')) {
      console.log(`${ctx.context.user.user.id} doesn't have access to ${path.toString()}`)
      return callback(webdav.Errors.BadAuthentication);
    }
    if (parent.hasChildNamed(path.fileName())) return callback(webdav.Errors.ResourceAlreadyExists);

    if (ctx.type.isDirectory) {
      new Folder(path.fileName(), ctx.context.user.user, parent)
      return callback(null)
    } else {
      new File({
        name: path.fileName(),
        size: 0,
        hash: null,
        folder: parent, 
        owner: ctx.context.user.user
      })
      return callback(null)
    }
  }

  _delete(path, ctx, callback) {
    let ff = FileOrFolder.lookupByPath(path.toString())
    if(!ff) return callback(webdav.Errors.ResourceNotFound);
    if(!ff.hasAccess(ctx.context.user.user, 'w')) {
      console.log(`${ctx.context.user.user.id} doesn't have access to ${path.toString()}`)
      return callback(webdav.Errors.BadAuthentication);
    }
    ff.delete();
    callback(null);
  }

  _move(pathFrom, pathTo, ctx, callback){
    let ffFrom = FileOrFolder.lookupByPath(pathFrom.toString())
    if(!ffFrom) return callback(webdav.Errors.ResourceNotFound);

    if (!ffFrom.hasAccess(ctx.context.user.user, 'w')) {
      console.log(`${ctx.context.user.user.id} doesn't have access to ${pathFrom.toString()}`)
      return callback(webdav.Errors.BadAuthentication);
    }

    let ffTo = FileOrFolder.lookupByPath(pathTo.toString())
    if(ffTo) return callback(webdav.Errors.ResourceAlreadyExists);
    let parent = Folder.lookupByPath(pathTo.getParent().toString())
    if(!parent) return callback(webdav.Errors.ResourceNotFound);

    if (!parent.hasAccess(ctx.context.user.user, 'w')) {
      console.log(`${ctx.context.user.user.id} doesn't have access to ${pathTo.toString()}`)
      return callback(webdav.Errors.BadAuthentication);
    }

    ffFrom.rel(parent, "parent", true)
    if(pathTo.fileName() && pathTo.fileName() != ffFrom.name){
      ffFrom.name = pathTo.fileName()
      if(ffFrom instanceof File)
        ffFrom.updateMime()
    }
    callback(null, true)
  }
  
  /*
  _copy(pathFrom, pathTo, ctx, ){
    
  }
  */
  
  _rename(pathFrom, newName, ctx, callback){
    let ff = FileOrFolder.lookupByPath(pathFrom.toString())
    if(!ff) return callback(webdav.Errors.ResourceNotFound);
    if (!ff.hasAccess(ctx.context.user.user, 'w')) {
      console.log(`${ctx.context.user.user.id} doesn't have access to ${pathFrom.toString()}`)
      return callback(webdav.Errors.BadAuthentication);
    }
    ff.name = newName;
    if(ff instanceof File)
      ff.updateMime()
    callback(null, true)
  }

  _mimeType(path, ctx, callback){
    let ff = FileOrFolder.lookupByPath(path.toString())
    if(!ff instanceof File) return callback(null, '')
    if(!ff.mime) ff.updateMime()
    callback(null, ff.mime)
  }

  _openWriteStream(path, ctx, callback) {
    let ff = FileOrFolder.lookupByPath(path.toString())
    if(!ff || !ff.tags.includes("file")) return callback(webdav.Errors.ResourceNotFound);

    ff.openBlob().then(stream => {
      stream.on("finish", async () => {
        let stats = await ff.blob.stats()
        ff.size = stats.size
        ff.updateHash()
      })
      callback(null, stream)
    })
  }

  _openReadStream(path, ctx, callback) {
    let file = FileOrFolder.lookupByPath(path.toString())
    if (!file || !(file instanceof File))
      return callback(webdav.Errors.ResourceNotFound);

    callback(null, file.blob);
  }

  _size(path, ctx, callback) {
    let file = FileOrFolder.lookupByPath(path.toString())
    callback(null, file.size || 0)
  }

  _lockManager(path, ctx, callback) {
    let pathString = path.toString()
    if (!DavFileSystem.lockManagers.has(pathString))
      DavFileSystem.lockManagers.set(pathString, new DavLockManager())
    callback(null, DavFileSystem.lockManagers.get(pathString))
  }

  _propertyManager(path, ctx, callback) {
    let pathString = path.toString()
    if (!DavFileSystem.propertyManagers.has(pathString))
      DavFileSystem.propertyManagers.set(pathString, new DavPropertyManager())
    callback(null, DavFileSystem.propertyManagers.get(pathString))
  }

  _readDir(path, ctx, callback) {
    let folder = FileOrFolder.lookupByPath(path.toString())
    if (!folder || !(folder instanceof Folder))
      return callback(webdav.Errors.ResourceNotFound);
    callback(null, folder.content.filter(c => c.hasAccess(ctx.context.user.user, 'r')).map(c => c.name));
  }

  _creationDate(path, ctx, callback) {
    let file = FileOrFolder.lookupByPath(path.toString())
    if (!file)
      return callback(webdav.Errors.ResourceNotFound);
    callback(null, file.timestamp ? new Date(file.timestamp).getTime() : 0)
  }
  
  _lastModifiedDate(path, ctx, callback) {
    let file = FileOrFolder.lookupByPath(path.toString())
    if (!file)
      return callback(webdav.Errors.ResourceNotFound);
    callback(null, file.timestamp ? new Date(file.timestamp).getTime() : 0)
  }
  
  _type(path, ctx, callback) {
    let file = FileOrFolder.lookupByPath(path.toString())
    if (!file)
      return callback(webdav.Errors.ResourceNotFound);
    callback(null, file.tags.includes("folder") ? ResourceType.Directory : ResourceType.File)
  }
}

class DavLockManager {
  locks = [];

  constructor(serializedData) {
    if (serializedData)
      for (const name in serializedData)
        this[name] = serializedData[name];
  }

  getLocks(callback) {
    this.locks = this.locks.filter((lock) => !lock.expired());

    callback(null, this.locks);
  }

  setLock(lock, callback) {
    this.locks.push(lock);
    callback(null);
  }

  removeLock(uuid, callback) {
    for (let index = 0; index < this.locks.length; ++index)
      if (this.locks[index].uuid === uuid) {
        this.locks.splice(index, 1);
        return callback(null, true);
      }

    callback(null, false);
  }

  getLock(uuid, callback) {
    this.locks = this.locks.filter((lock) => !lock.expired());

    for (const lock of this.locks)
      if (lock.uuid === uuid)
        return callback(null, lock);

    callback();
  }

  refresh(uuid, timeout, callback) {
    this.getLock(uuid, (e, lock) => {
      if (e || !lock)
        return callback(e);

      lock.refresh(timeout);
      callback(null, lock);
    })
  }
}

class DavPropertyManager {
  properties = {};

  constructor(serializedData) {
    if (serializedData)
      for (const name in serializedData)
        this[name] = serializedData[name];
  }

  setProperty(name, value, attributes, callback) {
    this.properties[name] = {
      value,
      attributes
    };
    callback(null);
  }

  getProperty(name, callback) {
    const property = this.properties[name];
    callback(property ? null : Errors.PropertyNotFound, property.value, property.attributes);
  }

  removeProperty(name, callback) {
    delete this.properties[name];
    callback(null);
  }

  getProperties(callback, byCopy = false) {
    callback(null, byCopy ? this.properties : JSON.parse(JSON.stringify(this.properties)));
  }
}