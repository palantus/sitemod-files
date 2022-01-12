import Entity from "entitystorage"

class Folder extends Entity {
  
  static lookup(id) {
    if(!id) return null;
    return Folder.find(`(id:${req.params.id}|prop:"hash=${req.params.id}") tag:folder`)
  }
}

export default Folder