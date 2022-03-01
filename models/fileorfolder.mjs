import Entity from "entitystorage"
import File from "./file.mjs";
import Folder from "./folder.mjs";

export default class FileOrFolder extends Entity {
  
  static lookup(id) {
    if(!id) return null;
    return FileOrFolder.find(`id:"${id}" (tag:file|tag:folder)`)
  }

  static lookupAccessible(idOrHash, user){
    if(!idOrHash) return null;
    let file = !isNaN(idOrHash) ? FileOrFolder.lookup(idOrHash)?.toType() : null
    if(file && file.hasAccess(user, 'r')) return file;
    if(isNaN(idOrHash)){
      return File.lookupAccessible(idOrHash, user)
    }
    return null;
  }

  static allByTag(tag) {
    if(!tag) return [];
    return FileOrFolder.search(`tag:"user-${tag}" (tag:file|tag:folder)`)
  }

  toType(){
    return this.tags.includes("folder") ? Folder.from(this) : File.from(this)
  }

  toObj(user){
    return this.toType().toObj(user);
  }
}