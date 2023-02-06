import SearchQueryParser from "searchqueryparser"
import { isFilterValid } from "entitystorage"
import File from "../models/file.mjs"
import FileOrFolder from "../models/fileorfolder.mjs"

export let tokens = [
  {keywords: ["id"], title: "Search for Id", resolve: token => `id:${token}`},
  {keywords: ["tag"], title: "Search for tag", resolve: (token, tag, service) => {
    return `tag:"user-${token}"`
  }},
  {keywords: ["type"], title: "Search for type (folder or file)", resolve: token => token == "folder" ? "tag:folder" : "tag:file"},
  {keywords: ["ext"], title: "Search for extension", resolve: token => `prop:"name=.${token}^"`},
  {keywords: ["folder"], title: "Search for folder content", resolve: (token, tag, service) => {
    if (token == "root" || !token)
      return "parent.tag:folder parent.tag:root"

    return `parent.prop:"name=${token}"|parent.id:${token}`
  }},
  {keywords: [null], title: "Search for text", resolve: token => token == "*" ? "!id:-20" : `prop:name~${token}`},
]

class Service {

  async storeFileFromHash(hash, tags, owner){
    if(tags.length < 1) throw "tags is mandatory"
    if(hash < 1) throw "hash is mandatory"

    let fileContent = await this.fetchFile(hash)
    if(!fileContent) throw "Unknown file"
    if(!fileContent.filename) throw "filename is mandatory"
    if(!fileContent.size) throw "size is mandatory"
    if(!fileContent.blob) throw "blob is mandatory"

    return new File({
      name: fileContent.filename || fileContent.name,
      size: fileContent.size,
      hash,
      mime: fileContent.mime||null,
      tags,
      data: fileContent.blob,
      owner
    })
  }

  async fetchFile(hash){
    // First check local files
    let file = File.lookupHash(hash)
    if (file) {
      return {filename: file.name, mime: file.mime, size: file.size, blob: file.blob}
    }
    return null;
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
  }

  search(query) {
    if(!isFilterValid(query)) return { results: [], tags: []};
    if(!this.parser){
      this.parser = new SearchQueryParser()
    }

    let q;
    if (query) {
      let ast = this.parser.parse(query.trim())
      q = this.parseE(ast);
    }

    try {
      let allResults = FileOrFolder.search(q ? `(tag:file|tag:folder) (${q})` : "(tag:file|tag:folder)")
      //first, last, start, end, after, before
      let res = allResults.map(f => f.toType())//.sort((a, b) => a.name <= b.name ? -1 : 1)

      return {results: res};
    } catch (err) {
      console.log(err)
      return { results: [], error: err};
    }
  }
}

export default new Service()