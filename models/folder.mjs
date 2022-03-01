import Entity from "entitystorage"
import FileOrFolder from "./fileorfolder.mjs";
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";

class Folder extends Entity {
  initNew(name, owner, parentFolder){
    this.tag("folder")
    this.name = name;
    this.rel(parentFolder, "parent")

    ACL.setDefaultACLOnEntity(this, owner, DataType.lookup("folder"))
  }
  
  static lookup(id) {
    if(!id) return null;
    return Folder.find(`id:"${id}" tag:folder`)
  }

  static lookupHash(hash) {
    if(!id) return null;
    return File.find(`prop:"hash=${hash}" tag:folder`)
  }

  static rootContent(){
    return Folder.search("tag:folder !content..tag:folder").map(c => FileOrFolder.from(c).toType())
  }

  get content(){
    return this.relsrev.parent?.map(c => FileOrFolder.from(c).toType()) || []
  }

  getChildFolderNamed(name, userForValidation){
    return Folder.search(`prop:"name=${name}" tag:folder parent.id:${this}`).filter(f => !userForValidation || f.hasAccess(user, 'r'))[0]||null
  }

  get parentPath(){
    let parent = this.related.parent
    if(!parent) return null
    let foundIds = new Set()
    let revPath = []
    while(parent){
      foundIds.add(parent._id)
      revPath.push(parent.tags.includes("root") ? "" : parent.name)
      parent = this.related.parent
      if(parent && foundIds.has(parent._id)) break;
    }
    return revPath.length < 2 ? "/" : revPath.reverse().join("/")
  }

  hasAccess(user, right = 'r'){
    return new ACL(this, DataType.lookup("folder")).hasAccess(user, right)
  }

  validateAccess(res, right, respondIfFalse = true){
    return new ACL(this, DataType.lookup("folder")).validateAccess(res, right, respondIfFalse)
  }

  rights(user){
    let acl = new ACL(this, DataType.lookup("folder"))
    return "" + (acl.hasAccess(user, "r")?'r':'') + (acl.hasAccess(user, "w")?'w':'')
  }

  toObj(user, includeContent = true){
    return {
      id: this._id,
      type: "folder",
      name: this.name,
      tags: this.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5)),
      rights: this.rights(user),
      parentPath: this.parentPath,
      content: includeContent ? this.content.map(c => c.toObj(user, false)) : undefined
    }
  }

  static root(){
    return Folder.find("tag:folder tag:root") || new Entity().tag("folder").tag("root").prop("name", "root").prop("acl", "r:public;w:public")
  }
}

export default Folder