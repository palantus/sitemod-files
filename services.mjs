import Permission from "../../models/permission.mjs"
import Role from "../../models/role.mjs"

export default async () => {
  // init
  Role.lookupOrCreate("files").addPermission(["file.upload", "file.edit", "file.read"], true)
  Role.lookupOrCreate("admin").addPermission(["file.source.manage"], true)

  return {
  }
}