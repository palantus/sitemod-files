import Role from "../../models/role.mjs"
import DataType from "../../models/datatype.mjs"
import Folder from "./models/folder.mjs"
import File from "./models/file.mjs"
import { startCleanupService } from "./services/cleanup.mjs"
import { query } from "entitystorage"

export default async () => {
  // init
  Role.lookupOrCreate("files").addPermission(["file.upload", "file.edit", "file.read", "file.drop"], true)
  Role.lookupOrCreate("admin").addPermission(["file.source.manage"], true)

  let folderType = DataType.lookupOrCreate("folder", {title: "Folder", permission: "file.read", api: "file", nameField: "name", uiPath: "folder", acl: "r:inherit;w:inherit", aclInheritance: true})
                           .init({typeModel: Folder})
  DataType.lookupOrCreate("file", {title: "File", permission: "file.read", api: "file", nameField: "name", uiPath: "file", acl: "r:inherit;w:inherit", aclInheritance: true, aclInheritFrom: folderType})
          .init({typeModel: File})
  
  Folder.sharedRoot()
  Folder.root().acl = "r:shared;w:private"

  // Remove empty tags:
  query.tag("file").tag("user-").all.forEach(f => f.removeTag("user-"))
  query.tag("folder").tag("user-").all.forEach(f => f.removeTag("user-"))

  return {
    cleanup: startCleanupService()
  }
}