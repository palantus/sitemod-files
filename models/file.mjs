import Entity from "entitystorage"

class File extends Entity {
  
  static lookup(id) {
    if(!id) return null;
    return File.find(`(id:${id}|prop:"hash=${id}") tag:file !tag:folder`)
  }
}

export default File