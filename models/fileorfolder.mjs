import Entity, {query} from "entitystorage"
import File from "./file.mjs";
import Folder from "./folder.mjs";

export default class FileOrFolder extends Entity {
  
  static lookup(id) {
    if(!id) return null;
    return query.type(FileOrFolder).id(id).and(query.tag("file").or(query.tag("folder"))).first
  }

  static lookupAccessible(idOrHash, user, shareKey){
    if(!idOrHash) return null;
    let file = !isNaN(idOrHash) ? FileOrFolder.lookup(idOrHash)?.toType() : null
    if(file && file.hasAccess(user, 'r', shareKey)) return file;
    if(isNaN(idOrHash)){
      return File.lookupAccessible(idOrHash, user, shareKey)
    }
    return null;
  }
  
  hasAccess(user, right = 'r', shareKey = null){
    return this.toType().hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true){
    return this.toType().validateAccess(res, right, respondIfFalse)
  }

  static lookupByPath(path){
    return path == "/" ? Folder.root() : path.substring(1).split("/").reduce((parent, name) => {
      return FileOrFolder.from(parent?.content.find(f => f.name == name))?.toType() || null
    }, Folder.root()) || null
  }

  static allByTag(tag) {
    if(!tag) return [];
    return query.type(FileOrFolder).tag(`user-${tag}`).and(query.tag("file").or(query.tag("folder"))).all
  }

  delete(){
    this.toType().delete()
  }

  toType(){
    return this.tags.includes("folder") ? Folder.from(this) : File.from(this)
  }

  toObj(user){
    return this.toType().toObj(user);
  }
}