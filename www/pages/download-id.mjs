const elementName = 'file-download-id-page'

import {state, setPageTitle, apiURL} from "../system/core.mjs"
import api from "../system/api.mjs"
import "../components/field-ref.mjs"
import { alertDialog } from "../components/dialog.mjs"
import {sizeToName} from "./file.mjs"
import Toast from "../components/toast.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
      padding: 10px;
    }
    .hidden{display: none;}
    #subtitle{color: gray; margin-left: 10px;}
    #maintitle {margin-bottom: 0px;}
    #subtitle-size, #subtitle-owner, #subtitle-modified{color: var(--accent-color-light);}
  </style>

  <div id="container">
    <h2 id="maintitle"><span id="title"></span></h2>
    <div id="subtitle">
      (<span id="subtitle-type"></span> owned by <span id="subtitle-owner"></span><span id="subtitle-size-container"> of size <span id="subtitle-size"></span></span>, last edited <span id="subtitle-modified"></span>)
    </div>
    <br>
    <button id="download-btn" class="styled">Download now</button>
    </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.downloadFile = this.downloadFile.bind(this)

    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)

    this.fileId = /([\da-zA-Z]+)/.exec(state().path.split("/")[3])[0]
  }

  async refreshData(id = this.fileId){
    setPageTitle("");
    let src = this.sourcePath = state().query.src
    let file;
    try{
      file = this.file = await api.get(src ? `${src}/file/${this.fileId}` : `file/${this.fileId}`, {redirectAuth: false})
    } catch(err){
      new Toast({text: `Error: ${err?.status||err} ${err?.statusText}`})
      return;
    }
    
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

    this.lastFileId = this.fileId
  }

  async downloadFile(){
    if(this.sourcePath){
      let {token} = await api.get("me/token")
      window.open(`${apiURL()}/${this.sourcePath}/file/download/${this.fileId}?token=${token}`)
    } else {
      window.open(this.file.links?.download) 
    }
  }

  connectedCallback() {
    this.refreshData(this.fileId);
  }

  disconnectedCallback() {
  }

}

window.customElements.define(elementName, Element);
export {Element, elementName as name}