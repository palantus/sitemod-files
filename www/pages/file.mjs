const elementName = 'file-page'

import {state, setPageTitle, goto} from "/system/core.mjs"
import api from "/system/api.mjs"
import {userPermissions} from "/system/user.mjs"
import "/components/field-edit.mjs"
import "/components/field-ref.mjs"
import "/components/field-list.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/file-preview.mjs"
import "/components/file-actions.mjs"
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
      <file-actions-component id="actions"/>
    </div>

    <div id="preview-container" class="hidden">
      <file-preview-component id="preview"/>
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

    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deleteFile)
    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)
    this.shadowRoot.getElementById("details-btn").addEventListener("click", () => toggleInRightbar("file-info", null, [["hideInfoButton", "true"], ["type", this.file.type], ["fileid", this.file.id]]))

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
    let fileDate = (file.modified||file.created||"");

    this.shadowRoot.getElementById('subtitle-type').innerText = file.type == "folder" ? "Folder" : "File"
    this.shadowRoot.getElementById('subtitle-owner').innerText = file.ownerId
    this.shadowRoot.getElementById('subtitle-modified').innerText = fileDate.replace("T", " ").substring(0, 19)
    this.shadowRoot.getElementById('subtitle-size-container').classList.toggle("hidden", file.type != "file")
    
    this.shadowRoot.getElementById('title').innerText = file.name

    this.shadowRoot.getElementById('download-btn').classList.toggle("hidden", file.type != "file")

    let permissions = await userPermissions()
    if((permissions.includes("file.edit") && file.rights.includes("w")) || permissions.includes("admin")){
      this.shadowRoot.getElementById("delete-btn").classList.remove("hidden")
    }

    this.shadowRoot.getElementById("preview-container").classList.toggle("hidden", file.type != "file")
    this.shadowRoot.getElementById("actions-container").classList.toggle("hidden", file.type != "file")

    if(file.type == "file" && (this.fileId != this.lastFileId || this.lastFileDate != fileDate)){
      this.shadowRoot.getElementById("preview").setAttribute("file-id", this.file.id)
      this.shadowRoot.getElementById("actions").setAttribute("file-id", this.file.id)
    }
    this.lastFileId = this.fileId
    this.lastFileDate = fileDate
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

export function sizeToNameMB(size){
  return size < 0.01 ? `${size*1000000} bytes`
       : size < 10 ? `${Math.floor(size*1000)} KB`
       : size < 10000 ? `${Math.floor(size)} MB`
       : `${Math.floor(size/1000)} GB`
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}