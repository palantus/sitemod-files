import SearchQueryParser from "searchqueryparser"
import Entity from "entitystorage"
import fileSourceService from "./filesource.mjs"
import { getTimestamp } from "../../../tools/date.mjs"
import fetch from "node-fetch"

export let tokens = [
  {keywords: ["id"], title: "Search for Id", resolve: token => `id:${token}`},
  {keywords: ["tag"], title: "Search for tag", resolve: (token, tag, service) => {
    service.tags.add(token)
    return `tag:"user-${token}"`
  }},
  {keywords: ["type"], title: "Search for type (folder or file)", resolve: token => token == "folder" ? "tag:folder" : "!tag:folder"},
  {keywords: ["ext"], title: "Search for extension", resolve: token => `prop:"name=.${token}^"`},
  {keywords: ["folder"], title: "Search for folder content", resolve: (token, tag, service) => {
    if (token == "root" || !token)
      return "tag:folder !parent.tag:folder"

    let folder = Entity.find(`tag:folder (id:"${token}"|prop:"name=${token}")`)
    if(folder && folder.filter){
      let ast = service.parser.parse(folder.filter)
      let q = service.parseE(ast);
      return `(parent.id:${folder}|${q})`;
    }

    return `(parent.id:${token}|parent.prop:"name=${token}")`
  }},
  {keywords: [null], title: "Search for text", resolve: token => token == "*" ? "!id:-20" : `prop:name~${token}`},
]

class Service {

  async storeFileFromHash(hash, tags){
    if(tags.length < 1) throw "tags is mandatory"
    if(hash < 1) throw "hash is mandatory"

    let fileContent = await this.fetchFile(hash)
    if(!fileContent) throw "Unknown file"
    if(!fileContent.filename) throw "filename is mandatory"
    if(!fileContent.size) throw "size is mandatory"
    if(!fileContent.blob) throw "blob is mandatory"

    let file = new Entity().tag("file")
          .prop("name", fileContent.filename)
          .prop("size", fileContent.size)
          .prop("hash", hash)
          .prop("mime", fileContent.mime || null)
          .prop("timestamp", getTimestamp())
          .setBlob(fileContent.blob.stream())

    for(let tag of tags.filter(t => t)) 
      file.tag(`user-${tag}`);
  }

  async fetchFile(hash){
    // First check local files
    let file = Entity.find(`(id:${hash}|prop:"hash=${hash}") tag:file !tag:folder`)
    if (file) {
      return {filename: file.name, mime: file.mime, size: file.size, blob: file.blob}
    }

    // Then check all file sources
    file = await fileSourceService.findFile(hash)
    if (!file) {
      return null;
    }
    let filename = file.details?.result?.filename || file.details?.filename || null
    let src = Entity.find(`tag:filesource id:${file.fileSource.id}`)
    let downloadUrl = src.downloadUrl.replace("$hash$", file.id);
    let url = fileSourceService.applyApiKeyParm(downloadUrl, Entity.find(`tag:filesource id:${src._id}`).apiKeyParm)

    let r = await fetch(url)
    
    let size = file.details?.result?.size || file.details?.size || r.headers.get("Content-Length") || null
    let mime = file.details?.result?.mime || file.details?.mime || r.headers.get("Content-Type") || null
    
    return {filename: filename, mime, size, blob: await r.blob()}
  }

  parseE(e) {
    switch (e.type) {
      case "and":
        return `(${this.parseE(e.e1)} ${this.parseE(e.e2)})`
      case "or":
        return `(${this.parseE(e.e1)}|${this.parseE(e.e2)})`
      case "not":
        return `!(${this.parseE(e.e)})`
      case "token":
        return this.parseToken(e.tag, e.token)
    }
  }

  parseToken(tag, token) {
    return tokens.find(t => t.keywords.includes(tag ? tag.toLowerCase() : null))?.resolve(token, tag, this) || (token == "*" ? "*" : "id:-20")
    /*
    switch (tag ? tag.toLowerCase() : undefined) {
      case "id":
        return `id:${token}`
      case "tag":
        this.tags.add(token)
        return `tag:"user-${token}"`
      case "type":
        return token == "folder" ? "tag:folder" : "!tag:folder"
      case "ext":
        return `prop:"name=.${token}^"`
      case "folder":
        if (token == "root" || !token)
          return "tag:folder !parent.tag:folder"

        let folder = Entity.find(`tag:folder (id:"${token}"|prop:"name=${token}")`)
        if(folder && folder.filter){
          let ast = this.parser.parse(folder.filter)
          let q = this.parseE(ast);
          return `(parent.id:${folder}|${q})`;
        }

        return `(parent.id:${token}|parent.prop:"name=${token}")`

      case undefined:
        return token == "*" ? "!id:-20" : `prop:name~${token}`
      default:
        return token == "*" ? "*" : "id:-20"
    }
    */
  }

  async search(query) {
    if(!this.parser){
      this.parser = new SearchQueryParser()
      await this.parser.init()
    }

    this.tags = new Set()

    let q;
    if (query) {
      let ast = this.parser.parse(query.trim())
      q = this.parseE(ast);
    }

    try {
      let allResults = Entity.search(q ? `tag:file (${q})` : "tag:file")
      //first, last, start, end, after, before
      let res = allResults//.sort((a, b) => a.name <= b.name ? -1 : 1)

      return {results: res, tags: [...this.tags]};
    } catch (err) {
      console.log(err)
      return { results: [], tags: [], error: err};
    }
  }
}

export default new Service()