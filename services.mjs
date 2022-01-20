import Permission from "../../models/permission.mjs"
import Role from "../../models/role.mjs"

export default async () => {
  
  Permission.lookupOrCreate("file.upload")
  Permission.lookupOrCreate("file.edit")
  Permission.lookupOrCreate("file.read")
  Permission.lookupOrCreate("file.source.manage")

  // init
  Role.lookupOrCreate("files").addPermission(["file.upload", "file.edit", "file.read"])
  Role.lookupOrCreate("admin").addPermission(["file.source.manage"])

  return {
  }
}