import Entity, { query } from "entitystorage"
import FileOrFolder from "./fileorfolder.mjs";
import ACL from "../../../models/acl.mjs"
import DataType from "../../../models/datatype.mjs";
import User from "../../../models/user.mjs";
import { getTimestamp } from "../../../tools/date.mjs";
import Share from "../../../models/share.mjs";

class Folder extends Entity {
  initNew(name, owner, parentFolder, { linkTo = null } = {}) {
    this.tag("folder")
    this.name = (name || "NewFolder").replace(/[\/#]/g, '-');
    this.timestamp = getTimestamp()
    this.rel(parentFolder, "parent")
    if (linkTo) {
      this.tag("symboliclink");
      this.rel(linkTo, "destination")
    }

    ACL.setDefaultACLOnEntity(this, owner.id == "guest" && parentFolder ? parentFolder.related.owner : owner, DataType.lookup("folder"))
  }

  static lookup(id) {
    if (!id) return null;
    return query.type(Folder).id(id).tag("folder").first
  }

  static lookupHash(hash) {
    if (!id) return null;
    return query.type(Folder).prop("hash", hash).tag("folder").first
  }

  static lookupByPath(path) {
    return path == "/" ? Folder.root() : path.substring(1).split("/").reduce((parent, name) => {
      return Folder.from(parent?.content.find(f => f.name == name && f.tags.includes("folder"))) || null
    }, Folder.root()) || null
  }

  static rootContent() {
    return Folder.search("tag:folder !content..tag:folder").map(c => FileOrFolder.from(c).toType())
  }

  static isOfType(entity) {
    if (!entity) return false;
    return entity.tags?.includes("folder") || false;
  }

  isSymbolicLink() {
    return this.tags.includes("symboliclink")
  }

  get content() {
    return this.isSymbolicLink() ? Folder.from(this.related.destination)?.content || []
      : this.relsrev.parent?.map(c => FileOrFolder.from(c).toType()) || []
  }

  accessibleContent(user, shareKey) {
    return this.content.filter(c => c.hasAccess(user, 'r', shareKey))
  }

  getChildFolderNamed(name) {
    return this.content.filter(f => f.name == name && f.tags.includes("folder"))[0] || null
  }

  hasChildNamed(name) {
    return !!this.content.find(f => f.name == name)
  }

  get path() {
    let parent = Folder.from(this.related.parent)
    return parent ? `${parent?.path || ""}/${this.name}` : ""
  }

  get parentPath() {
    let parent = Folder.from(this.related.parent)
    return parent ? parent?.path || "/" : null
  }

  hasAccess(user, right = 'r', shareKey = null) {
    return new ACL(this, DataType.lookup("folder")).hasAccess(user, right, shareKey)
  }

  validateAccess(res, right, respondIfFalse = true) {
    return new ACL(this, DataType.lookup("folder")).validateAccess(res, right, respondIfFalse)
  }

  rights(user, shareKey) {
    let acl = new ACL(this, DataType.lookup("folder"))
    return "" + (acl.hasAccess(user, "r", shareKey) ? 'r' : '') + (acl.hasAccess(user, "w", shareKey) ? 'w' : '')
  }

  get owner() {
    return User.from(this.related.owner)
  }

  get userTags() {
    return this.tags.filter(t => t.startsWith("user-")).map(t => t.substr(5))
  }

  toObj(user, shareKey, includeContent = true) {
    return {
      id: this._id,
      type: "folder",
      name: this.name,
      ownerId: this.owner?.id || null,
      tags: this.userTags,
      rights: this.rights(user, shareKey),
      parentPath: this.parentPath,
      created: this.timestamp,
      content: includeContent ? this.content.filter(c => c.hasAccess(user, 'r', shareKey)).map(c => c.toObj(user, shareKey, false)) : undefined,
      isSymbolic: this.isSymbolicLink()
    }
  }

  delete() {
    if (this.tags.includes("root") || this.tags.includes("sharedroot")) return;
    if (!this.isSymbolicLink()) {
      this.content.forEach(c => c.delete())
    }
    this.rels.share?.forEach(s => Share.from(s).delete())
    super.delete()
  }

  static root() {
    return query.type(Folder).tag("root").tag("folder").first
      || new Folder("", User.lookupAdmin())
        .tag("root")
        .prop("acl", "r:shared;w:private")
  }

  static homeRoot() {
    return query.type(Folder).tag("homeroot").tag("folder").first
      || new Folder("home", User.lookupAdmin(), Folder.root())
        .tag("homeroot")
        .prop("acl", "r:shared;w:private")
  }

  static userRoot(user) {
    if (!user || user.id == "guest") return null;
    return query.type(Folder).tag("userroot").tag("folder").relatedTo(user, "owner").first
      || new Folder(user.id, user, Folder.homeRoot())
        .tag("userroot")
        .prop("acl", "r:private;w:private")
  }

  static sharedRoot() {
    return query.type(Folder).tag("sharedroot").tag("folder").first
      || new Folder("shared", User.lookupAdmin(), Folder.root())
        .tag("sharedroot")
        .prop("acl", "r:shared;w:shared")
  }
}

export default Folder
