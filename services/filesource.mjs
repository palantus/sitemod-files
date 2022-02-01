import fetch from "node-fetch"
import Entity from "entitystorage"

class FileSourceService{
  static async findFileAll(id){
    let promiseResults = await Promise.all(Entity.search(`tag:filesource`).map(fs => {
      return new Promise(async resolve => {
        let exists = false;
        let res;
        let details = null;
        let url = (fs.detailsUrl || fs.existsUrl || fs.downloadUrl).replace("$hash$", id)
        let urlForFetch = FileSourceService.applyApiKeyParm(url, fs.apiKeyParm)

        try{
          res = await fetch(urlForFetch)
          exists = res.status == 200
          let body = null
          if(exists){
            if(res.headers.get("content-type") == "application/json"){
              body = await res.json()
              exists = body?.result === false || body?.success === false ? false : true
            } else {
              body = await res.text()
              exists = body === "false" ? false : true;
            }
          }
          if(fs.detailsUrl){
            details = typeof body === "object" && body.result ? body.result : body
          } else {
            details = body || null
          }
        } catch(err){
          console.log(err)
        }
        resolve({id, fileSource: {id: fs._id, title: fs.title}, exists: exists, statusCode: res?.status, statusText: res?.statusText, details, url})
      })
    }));
    return promiseResults
  }

  static async findFile(id){
    let res = await FileSourceService.findFileAll(id)
    return res.find(f => f.exists) || null
  }

  static applyApiKeyParm(url, apiKeyParm){
    if(!apiKeyParm) return url;

    let urlObj = new URL(url)
    let parms = new URLSearchParams(urlObj.search.slice(1))
    parms.set.apply(parms, apiKeyParm.split("="))
    urlObj.search = parms.toString()
    return urlObj.toString()
  }
}
export default FileSourceService