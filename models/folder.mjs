import Entity from "entitystorage"
import FileOrFolder from "./fileorfolder.mjs";
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";
import User from "../../../models/user.mjs";

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
    return this.content.filter(f => f.name == name && f.tags.includes("folder") && (!userForValidation || f.hasAccess(userForValidation, 'r')))[0]||null
  }

  hasChildNamed(name){
    return !!this.content.find(f => f.name == name)
  }

  get path(){
    let parent = Folder.from(this.related.parent)
    return parent ? `${parent?.path||""}/${this.name}` : ""
  }

  get parentPath(){
    let parent = Folder.from(this.related.parent)
    return parent ? parent?.path || "/" : null
  }

  hasAccess(user, right = 'r', shareKey = null){
    return new ACL(this, DataType.lookup("folder")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true){
    return new ACL(this, DataType.lookup("folder")).validateAccess(res, right, respondIfFalse)
  }

  rights(user){
    let acl = new ACL(this, DataType.lookup("folder"))
    return "" + (acl.hasAccess(user, "r")?'r':'') + (acl.hasAccess(user, "w")?'w':'')
  }

  toObj(user, shareKey, includeContent = true){
    return {
      id: this._id,
      type: "folder",
      name: this.name,
      tags: this.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5)),
      rights: this.rights(user),
      parentPath: this.parentPath,
      content: includeContent ? this.content.filter(c => c.hasAccess(user, 'r', shareKey)).map(c => c.toObj(user, shareKey, false)) : undefined
    }
  }

  delete(){
    if(this.tags.includes("root") || this.tags.includes("sharedroot") || this.tags.includes("userroot")) return;
    this.content.forEach(c => c.delete())
    super.delete()
  }

  static root(){
    return Folder.find("tag:root tag:folder") 
      || new Folder("", User.lookupAdmin())
            .tag("root")
            .prop("acl", "r:public;w:public")
  }

  static userRoot(user){
    if(!user || user.id == "guest") return null;
    return Folder.find(`tag:userroot tag:folder owner.id:${user}`) 
      || new Folder(user.id, user, Folder.root())
            .tag("userroot")
            .prop("acl", "r:private;w:private")
  }

  static sharedRoot(){
    return Folder.find("tag:sharedroot tag:folder") 
      || new Folder("shared", User.lookupAdmin(), Folder.root())
            .tag("sharedroot")
            .prop("acl", "r:shared;w:shared")
  }
}

export default Folder