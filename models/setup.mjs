import Entity, { query } from "entitystorage";

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

  toObj(){
    return {
      onlyASCIIHeaders: this.onlyASCIIHeaders
    }
  }
}