import {goto} from "/system/core.mjs"
import {Command, removeKeywordsFromQuery} from "/pages/tools/command-palette/command.mjs"
import {apiURL} from "/system/core.mjs"

export class DownloadFile extends Command{
  static keywords = [
    {words: ["download", "dl", "file"], mandatory: true}
  ]

  static createInstances(context){
    let query = removeKeywordsFromQuery(context.query, this.keywords)

    let hash = query[0];
    if(!hash) return [];
    
    let cmd = new DownloadFile()
    cmd.hash = hash;
    cmd.context = context;
    cmd.title = `Download file ${hash}`
    return [cmd]
  }

  async run(){
    window.open(`${apiURL()}/file/download/${this.hash}`)
  }
}

export class FindFile extends Command{
  static keywords = [
    {words: ["file", "find"], mandatory: true}
  ]

  static createInstances(context){
    let query = removeKeywordsFromQuery(context.query, this.keywords)

    let hash = query[0];
    if(!hash) return [];
    
    let cmd = new FindFile()
    cmd.hash = hash;
    cmd.context = context;
    cmd.title = `Find file ${hash}`
    return [cmd]
  }

  async run(){
    window.open(`${apiURL()}/file/${this.hash}`)
  }
}

export class InspectFile extends Command{
  static keywords = [
    {words: ["inspect", "ld", "ld2"], mandatory: true},
    {words: ["file", "hash"], mandatory: false}
  ]

  static createInstances(context){
    let query = removeKeywordsFromQuery(context.query, this.keywords)

    let hash = query[0];
    if(!hash) return [];
    
    let cmd = new InspectFile()
    cmd.hash = hash;
    cmd.context = context;
    cmd.title = `Inspect ld2 file: ${hash}`
    return [cmd]
  }

  async run(){
    goto(`/inspect-ld?hash=${this.hash}`)
  }
}