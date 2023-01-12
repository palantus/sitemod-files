const elementName = 'file-page'

import {state, setPageTitle, goto} from "/system/core.mjs"
import api from "/system/api.mjs"
import {userPermissions} from "/system/user.mjs"
import "/components/field-edit.mjs"
import "/components/field-ref.mjs"
import "/components/field-list.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/pages/tools/inspect-ld.mjs"
import { confirmDialog } from "../../components/dialog.mjs"
import { alertDialog } from "../../components/dialog.mjs"
import { toggleInRightbar } from "/pages/rightbar/rightbar.mjs"
import {getFileActions} from "/libs/actions.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
      padding: 10px;
    }
    #preview-container{margin-top: 20px;}
    #preview object{
      width: 100%;
      height: 600px;
    }
    #preview img{
      width: 100%;
      background-color: white;
    }
    #preview table thead tr{
      border-bottom: 1px solid gray;
    }
    .hidden{display: none;}
    #subtitle{color: gray; margin-left: 10px;}
    #maintitle {margin-bottom: 0px;}
    #subtitle-size, #subtitle-owner, #subtitle-modified{color: var(--accent-color-light);}
    video{width: 100%;}
    #actions-container{margin-top: 10px;}
    #action-component-container{margin-top: 10px;}
  </style>

  <action-bar>
    <action-bar-item id="download-btn">Download</action-bar-item>
    <action-bar-item id="details-btn">Details</action-bar-item>
    <action-bar-item id="delete-btn" class="hidden">Delete</action-bar-item>
  </action-bar>
    
  <div id="container">
    <h2 id="maintitle"><span id="title"></span></h2>
    <div id="subtitle">
      (<span id="subtitle-type"></span> owned by <span id="subtitle-owner"></span><span id="subtitle-size-container"> of size <span id="subtitle-size"></span></span>, last edited <span id="subtitle-modified"></span>)
    </div>
  
    <div id="actions-container" class="hidden">
    </div>

    <div id="action-component-container" class="hidden">
    </div>

    <div id="preview-container" class="hidden">
      <div id="preview"></div>
    </div>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.deleteFile = this.deleteFile.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.actionsClick = this.actionsClick.bind(this)

    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deleteFile)
    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)
    this.shadowRoot.getElementById("details-btn").addEventListener("click", () => toggleInRightbar("file-info", null, [["hideInfoButton", "true"], ["type", this.file.type], ["fileid", this.file.id]]))
    this.shadowRoot.getElementById("actions-container").addEventListener("click", this.actionsClick)

    this.fileId = /([\da-zA-Z]+)/.exec(state().path.split("/")[2])[0]
  }

  async refreshData(id = this.fileId){
    setPageTitle("");
    let file = this.file = await api.get(`file/${this.fileId}`)
    
    if(!file){
      alertDialog("This file or folder could not be found. Either it doesn't exist or you do not have access to it")
      return;
    }

    this.fileId = file.id

    setPageTitle(file.name);
    

    if(file.type == "file"){
      let sizeName = sizeToName(file.size)

      this.shadowRoot.getElementById('subtitle-size').innerText = sizeName
    }

    this.shadowRoot.getElementById('subtitle-type').innerText = file.type == "folder" ? "Folder" : "File"
    this.shadowRoot.getElementById('subtitle-owner').innerText = file.ownerId
    this.shadowRoot.getElementById('subtitle-modified').innerText = (file.modified||file.created||"").replace("T", " ").substring(0, 19)
    this.shadowRoot.getElementById('subtitle-size-container').classList.toggle("hidden", file.type != "file")
    
    this.shadowRoot.getElementById('title').innerText = file.name

    this.shadowRoot.getElementById('download-btn').classList.toggle("hidden", file.type != "file")

    let permissions = await userPermissions()
    if((permissions.includes("file.edit") && file.rights.includes("w")) || permissions.includes("admin")){
      this.shadowRoot.getElementById("delete-btn").classList.remove("hidden")
    }

    let actions = getFileActions(file.mime);
    this.shadowRoot.getElementById("actions-container").classList.toggle("hidden", actions.length == 0)
    this.shadowRoot.getElementById("action-component-container").classList.toggle("hidden", true);
    if(actions.length > 0){
      this.shadowRoot.getElementById("actions-container").innerHTML = actions
                              .filter(a => !a.access || file.rights.includes(a.access))
                              .filter(a => !a.permission || permissions.includes(a.permission))
                              .map(a => `<button class="styled" data-action-id="${a.id}">${a.title}</button>`).join("")
    }

    this.shadowRoot.getElementById("preview-container").classList.toggle("hidden", file.type != "file")

    if(file.type == "file" && this.fileId != this.lastFileId){
      this.refreshPreview();
    }
    this.lastFileId = this.fileId
  }

  async refreshPreview(){
    let file = this.file
    this.shadowRoot.getElementById("preview").innerHTML = ""
      if(file.type == "file"){
        switch(file.mime){
          case "image/gif":
          case "image/jpg":
          case "image/jpeg":
          case "image/png":
          case "image/svg+xml": {
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let blob = await res.blob()
            let objectURL = URL.createObjectURL(blob);
            let img = document.createElement("img")
            img.src = objectURL
            this.shadowRoot.getElementById("preview").appendChild(img)
            break;
          }

          case "application/pdf": {
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let blob = await res.blob()
            let objectURL = URL.createObjectURL(blob);
            this.shadowRoot.getElementById("preview").innerHTML = `
              <object data="${objectURL}" type="application/pdf">
                <embed src="${objectURL}" type="application/pdf" />
              </object>
            `
            break;
          }

          case "application/javascript":
          case "text/csv":
          case "application/x-shellscript":
          case "text/x-log":
          case "text/markdown":
          case "application/x-sql":
          case "text/plain": {
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let text = await res.text()
            let div = document.createElement("pre")
            div.innerText = text
            this.shadowRoot.getElementById("preview").appendChild(div)
            break;
          }

          case "video/mp4": 
          case "video/webm": {
            this.shadowRoot.getElementById("preview").innerHTML = `
            <video controls>
              <source src="${this.file.links?.raw}" type="${file.mime}">
              Your browser does not support the video tag.
            </video> 
            `
            break;
          }

          case "audio/mpeg": {
            this.shadowRoot.getElementById("preview").innerHTML = `
            <audio controls>
              <source src="${this.file.links?.raw}" type="${file.mime}">
              Your browser does not support the audio tag.
            </audio> 
            `
            break;
          }

          case "application/json": {
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let text = await res.text()
            let div = document.createElement("pre")
            try{
              div.innerText = JSON.stringify(JSON.parse(text), null, 2)
            } catch(err){
              div.innerText = text
            }
            this.shadowRoot.getElementById("preview").appendChild(div)
            break;
          }

          case "application/ld2": {
            this.shadowRoot.getElementById("preview").innerHTML = `
              <inspect-ld-page hash=${this.file.hash} hidecontrols></inspect-ld-page>
            `
            break;
          }

          case "application/zip": {
            this.shadowRoot.getElementById("preview").innerHTML = "<p>Loading preview...</p>"
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let blob = await res.blob()
            import("https://deno.land/x/zipjs/index.js").then(async zip => {
              let entries = await (new zip.ZipReader(new zip.BlobReader(blob))).getEntries()
              this.shadowRoot.getElementById("preview").innerHTML = `
                <h2>Content</h2>
                <table>
                  <thead>
                    <tr>
                      <th>File</th><th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${entries.map(e => `<tr><td>${e.filename}</td><td>${sizeToName(e.uncompressedSize)}</td></tr>`).join("")}
                  </tbody>
                </table>
              `
            })
            break;
          }

          default: 
            this.shadowRoot.getElementById("preview").innerText = "No preview for this file type"
        }
      }
  }
  
  async deleteFile(){
    if(!await confirmDialog(`Are you sure that you want to delete ${this.file.type} ${this.file.name}?` + (this.file.type == "folder" ? " It will not delete all files in it!":""))) return;
    await api.del(`file/${this.fileId}`)
    window.history.back();
  }

  async downloadFile(){
    if(typeof window.showSaveFilePicker === "undefined") { //Firefox
      window.open(this.file.links?.download)
      return;
    }
    
    const options = {
      suggestedName: this.file.name
    };

    try{
      let filePickerPromise = window.showSaveFilePicker(options);
      let file = await (await api.fetch(`file/dl/${this.fileId}`)).blob()
      const newHandle = await filePickerPromise;
      const writableStream = await newHandle.createWritable();
      await writableStream.write(file);
      await writableStream.close();
    }catch(err){}
  }

  actionsClick(e){
    let id = e.target.getAttribute("data-action-id")
    if(!id) return;


    let action = getFileActions(this.file.mime).find(a => a.id == id);
    if(!action) return;

    if(action.path){
      goto(`${path}?file-id=${this.file.id}`)
    } else {
      if(!this.shadowRoot.getElementById("action-component-container").classList.contains("hidden")){
        this.refreshData()
        this.refreshPreview()
        return;
      }
      let container = this.shadowRoot.getElementById("action-component-container");
      import(action.componentPath).then(() => {
        container.innerHTML = `<${action.componentName} file-id="${this.file.id}"></${action.componentName}>`
        container.classList.toggle("hidden", false)
      })
      this.shadowRoot.getElementById("preview-container").classList.toggle("hidden", true)
    }
  }

  connectedCallback() {
    this.refreshData(this.fileId);
  }

  disconnectedCallback() {
  }

}

export function sizeToName(size){
  return size < 1000 ? `${size} bytes`
       : size < 1000000 ? `${Math.floor(size/1000)} KB`
       : `${Math.floor(size/1000000)} MB`
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}