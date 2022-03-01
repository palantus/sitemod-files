import Role from "../../models/role.mjs"
import DataType from "../../models/datatype.mjs"

export default async () => {
  // init
  Role.lookupOrCreate("files").addPermission(["file.upload", "file.edit", "file.read"], true)
  Role.lookupOrCreate("admin").addPermission(["file.source.manage"], true)

  let folderType = DataType.lookupOrCreate("folder", {title: "Folder", permission: "file.read", api: "file", nameField: "name", uiPath: "file", query: "tag:folder", acl: "r:inherit;w:inherit", aclInheritance: true})
  DataType.lookupOrCreate("file", {title: "File", permission: "file.read", api: "file", nameField: "name", uiPath: "file", query: "tag:file", acl: "r:inherit;w:inherit", aclInheritance: true, aclInheritFrom: folderType})
  
  return {
  }
}