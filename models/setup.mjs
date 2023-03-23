import Entity, { query } from "entitystorage";
import Role from "../../../models/role.mjs"
import File from "./file.mjs"

export default class Setup extends Entity{
  initNew(){
    this.tag("filessetup")
  }

  static lookup(){
    return query.type(Setup).tag("filessetup").first || new Setup()
  }

  patch(obj){
    if(typeof obj.onlyASCIIHeaders === "boolean") this.onlyASCIIHeaders = obj.onlyASCIIHeaders;
  }

  static userQuotaMB(user){
    return user.rolesTyped.reduce((curQuota, role) => {
      if(role.fileQuota !== undefined && role.fileQuota !== null && (curQuota === null || role.fileQuota > curQuota)) {
        return role.fileQuota
      }
      return curQuota;
    }, null)
  }

  static userUsageMB(user){
    return File.allByOwner(user).reduce((usage, file) => usage + (file.size ? (file.size / 1_000_000) : 0), 0)
  }

  static userCanStoreSize(user, size){
    let quota = this.userQuotaMB(user)
    if(isNaN(quota)) return true;
    return (Setup.userUsageMB(user) + ((isNaN(size) ? 0 : parseInt(size)) / 1_000_000)) <= quota
  }

  toObj(){
    return {
      onlyASCIIHeaders: this.onlyASCIIHeaders,
      roles: Role.all().map(role => ({
        id: role.id, 
        quota: role.fileQuota !== undefined ? role.fileQuota : null
      }))
    }
  }
}