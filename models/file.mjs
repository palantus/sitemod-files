import Entity, { query } from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs";
import { service as userService } from "../../../services/user.mjs"
import Folder from "./folder.mjs";
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";
import stream from "stream";
import crypto from "crypto";
import mime from "mime-types"
import User from "../../../models/user.mjs";

export default class File extends Entity {

  initNew({ folder, name, size, md5, hash, mimetype, mime, tags, tag, data, expire, owner }) {
    this.tag("file")

    this.name = (name || "NewFile").replace(/[\/#]/g, '-')
    this.updateMime(mimetype || mime)
    this.size = isNaN(size) ? 0 : parseInt(size)
    this.hash = md5 || hash || null
    this.timestamp = getTimestamp()
    this.setExpiration(expire)
    if (tag && typeof tag === "string")
      this.tag(`user-${tag}`)
    if (tags && Array.isArray(tags))
      tags.forEach(t => this.tag(t ? `user-${t}` : null))
    if (data)
      this.setBlob(data)

    this.rel(folder, "parent")

    ACL.setDefaultACLOnEntity(this, owner.id == "guest" && folder ? folder.related.owner : owner, DataType.lookup("file"))
  }

  markModified(){
    this.modified = getTimestamp()
  }

  static lookup(id) {
    if (!id) return null;
    return query.type(File).tag("file").id(id).not(query.tag("folder")).first
  }

  static lookupHash(hash) {
    if (!hash) return null;
    return query.type(File).tag("file").prop("hash", hash).not(query.tag("folder")).first
  }

  static lookupAccessible(idOrHash, user, shareKey) {
    if (!idOrHash) return null;
    let file = !isNaN(idOrHash) ? File.lookup(idOrHash) : null
    if (file && file.hasAccess(user, 'r', shareKey)) return file;
    if (isNaN(idOrHash)) {
      for (let file of query.type(File).tag("file").prop("hash", idOrHash).not(query.tag("folder")).all) {
        if (file.hasAccess(user, 'r', shareKey))
          return file;
      }
    }
    return null;
  }

  updateMime(suggestion) {
    let filename = this.name
    let newMimeType = mime.lookup(filename)
    if(newMimeType)
      this.mime = newMimeType
    else if(filename?.endsWith(".ps1"))
      this.mime = "text/plain"
    else if(filename?.endsWith(".ld2"))
      this.mime = "application/ld2"
    else if(suggestion)
      this.mime = suggestion
    else
      this.mime = 'application/octet-stream'

    this.updateMimeTypes()
  }

  updateMimeTypes(){
    if(!this.mime) this.updateMime()
    let mimeSplit = this.mime.split("/")
    this.mimeType = mimeSplit[0]||null
    this.mimeSubType = mimeSplit[1]||null
  }

  setExpiration(expire) {
    if (expire && typeof expire === "string") {
      this.expire = expire
      this.tag("temp")
    } else {
      this.expire = null;
      this.removeTag("temp")
    }
  }

  get parentPath() {
    let parent = this.related.parent
    if (!parent) return null;
    let parentPath = Folder.from(parent).parentPath
    return `${parentPath}${parentPath?.endsWith("/") ? "" : "/"}${parent.name}`
  }

  hasAccess(user, right = 'r', shareKey = null) {
    return new ACL(this, DataType.lookup("file")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true) {
    return new ACL(this, DataType.lookup("file")).validateAccess(res, right, respondIfFalse)
  }

  rights(user, shareKey) {
    let acl = new ACL(this, DataType.lookup("file"))
    return "" + (acl.hasAccess(user, "r", shareKey) ? 'r' : '') + (acl.hasAccess(user, "w", shareKey) ? 'w' : '')
  }

  async updateHash() {
    if (!this.blob) return;
    return new Promise(resolve => {
      this.blob.pipe(new MD5Stream().on("hashed", hash => {
        this.hash = hash
        resolve(hash)
      }))
    })
  }

  static async calculateMissingHashes() {
    for (let fb of FileBlob.search("tag:file !prop:hash blob")) {
      await fb.updateHash()
    }
  }

  static all() {
    return query.type(File).tag("file").all
  }

  static allByTag(tag) {
    if (!tag) return [];
    return query.type(File).tag(`user-${tag}`).tag("file").all
  }

  get owner(){
    return User.from(this.related.owner)
  }

  get userTags(){
    return this.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5))
  }

  getLinks(user, shareKey){
    return {
      download: `${global.sitecore.apiURL}/file/dl/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?${shareKey ? `shareKey=${shareKey}` : `token=${userService.getTempAuthToken(user)}`}`,
      raw: `${global.sitecore.apiURL}/file/raw/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?token=${userService.getTempAuthToken(user)}`,
    }
  }

  toObj(user, shareKey) {
    return {
      id: this._id,
      type: "file",
      name: this.name,
      size: this.size || null,
      hash: this.hash || null,
      created: this.timestamp || null,
      modified: this.modified || null,
      mime: this.mime || null,
      ownerId: this.owner?.id || null,
      tags: this.userTags,
      parentPath: this.parentPath,
      rights: this.rights(user, shareKey),
      expirationDate: this.expire || null,
      links: this.getLinks(user, shareKey)
    }
  }
}

class MD5Stream extends stream.Writable {
  constructor() {
    super()
    this._hasher = crypto.createHash("md5");
    this.once("finish", this._handleFinish.bind(this));
  }

  _handleFinish() {
    this.emit("hashed", this._hasher.digest("hex"));
  }

  _write(chunk, encoding, writeComplete) {
    this._hasher.update(chunk, encoding);
    writeComplete();
  }
}