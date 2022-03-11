import Entity from "entitystorage"
import { getTimestamp } from "../../../tools/date.mjs";
import {service as userService} from "../../../services/user.mjs"
import Folder from "./folder.mjs";
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";
import stream from "stream" ;
import crypto from "crypto" ;
import mime from "mime-types"

export default class File extends Entity {
  
  initNew({folder, name, size, md5, hash, mimetype, mime, tags, tag, data, expire, owner}){
    this.tag("file")

    this.name = (name||"NewFile").replace(/[\/#]/g, '-')
    this.updateMime()
    this.size = isNaN(size) ? 0 : parseInt(size)
    this.hash = md5 || hash
    this.mime = mimetype || mime
    this.timestamp = getTimestamp()
    this.setExpiration(expire)
    if(tag && typeof tag === "string")
      this.tag(`user-${tag}`)
    if(tags && Array.isArray(tags))
      tags.forEach(t => this.tag(t ? `user-${t}` : null))
    if(data)
      this.setBlob(data)

    this.rel(folder, "parent")

    ACL.setDefaultACLOnEntity(this, owner.id == "guest" && folder ? folder.related.owner : owner, DataType.lookup("file"))
  }

  static lookup(id) {
    if(!id) return null;
    return File.find(`id:"${id}" tag:file !tag:folder`)
  }

  static lookupHash(hash) {
    if(!hash) return null;
    return File.find(`prop:"hash=${hash}" tag:file !tag:folder`)
  }

  static lookupAccessible(idOrHash, user, shareKey){
    if(!idOrHash) return null;
    let file = !isNaN(idOrHash) ? File.lookup(idOrHash) : null
    if(file && file.hasAccess(user, 'r', shareKey)) return file;
    if(isNaN(idOrHash)){
      for(let file of File.search(`prop:"hash=${idOrHash}" tag:file !tag:folder`)){
        if(file.hasAccess(user, 'r', shareKey)) 
          return file;
      }
    }
    return null;
  }

  updateMime(){
    this.mime = mime.lookup(this.name) || 'application/octet-stream'
  }

  setExpiration(expire){
    if(expire && typeof expire === "string"){
      this.expire = expire
      this.tag("temp")
    } else {
      this.expire = null;
      this.removeTag("temp")
    }
  }

  get parentPath(){
    let parent = this.related.parent
    if(!parent) return null;
    let parentPath = Folder.from(parent).parentPath
    return `${parentPath}${parentPath?.endsWith("/")?"":"/"}${parent.name}`
  }

  hasAccess(user, right = 'r', shareKey = null){
    return new ACL(this, DataType.lookup("file")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true){
    return new ACL(this, DataType.lookup("file")).validateAccess(res, right, respondIfFalse)
  }

  rights(user, shareKey){
    let acl = new ACL(this, DataType.lookup("file"))
    return "" + (acl.hasAccess(user, "r", shareKey)?'r':'') + (acl.hasAccess(user, "w", shareKey)?'w':'')
  }

  async updateHash(){
    if(!this.blob) return;
    return new Promise(resolve => {
      this.blob.pipe(new MD5Stream().on("hashed", hash => {
        this.hash = hash
        resolve(hash)
      }))
    })
  }

  static async calculateMissingHashes(){
    for(let fb of FileBlob.search("tag:file !prop:hash blob")){
      await fb.updateHash()
    }
  }

  toObj(user, shareKey){
    return {
      id: this._id,
      type: "file",
      name: this.name,
      size: this.size || null,
      hash: this.hash || null,
      mime: this.mime || null,
      ownerId: this.related.owner?.id || null,
      tags: this.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5)),
      parentPath: this.parentPath,
      rights: this.rights(user, shareKey),
      expirationDate: this.expire || null,
      links: {
        download: `${global.sitecore.apiURL}/file/dl/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?${shareKey ? `shareKey=${shareKey}` : `token=${userService.getTempAuthToken(user)}`}`,
        raw: `${global.sitecore.apiURL}/file/raw/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?token=${userService.getTempAuthToken(user)}`,
      }
    }
  }
}

class MD5Stream extends stream.Writable{
  constructor(){
    super()
    this._hasher = crypto.createHash( "md5" );
    this.once( "finish", this._handleFinish.bind( this ) );
  }

  _handleFinish() {
    this.emit( "hashed", this._hasher.digest( "hex" ) );
  }

  _write( chunk, encoding, writeComplete ) {
    this._hasher.update( chunk, encoding );
    writeComplete();
  }
}