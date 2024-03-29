const elementName = 'file-download-filter-page'

import {state, setPageTitle, apiURL, stylesheets} from "../system/core.mjs"
import api from "../system/api.mjs"
import "../components/field-ref.mjs"
import { alertDialog } from "../components/dialog.mjs"
import {sizeToName} from "./file.mjs"
import Toast from "../components/toast.mjs"

const template = document.createElement('template');
template.innerHTML = `

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
      (<span id="subtitle-count"></span> files <span id="subtitle-size-container"> of size <span id="subtitle-size"></span></span>)
    </div>

    <div id="files"></div>
    <br>
    <button id="download-btn" class="styled">Download now</button>
    </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' })
        .adoptedStyleSheets = [stylesheets.global, stylesheets.searchresults];
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.downloadFiles = this.downloadFiles.bind(this)

    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFiles)
  }

  async refreshData(){
    this.filter = state().query.filter

    // Reset view
    setPageTitle("");
    this.shadowRoot.getElementById('title').innerText = ''
    this.shadowRoot.getElementById('subtitle-count').innerText = '';
    this.shadowRoot.getElementById('subtitle-size').innerText = ''

    let src = this.sourcePath = state().query.src
    let files;
    try{
      files = this.files = (await api.get(src ? `${src}/file/query?filter=${this.filter}` : `file/query?filter=${this.filter}`, {redirectAuth: false})).filter(f => f.type == "file")
    } catch(err){
      new Toast({text: `Error: ${err?.status||err} ${err?.statusText}`})
      return;
    }
    
    if(files.length < 1){
      alertDialog("No files could not be found. Either they doesn't exist or you do not have access to any of them")
      return;
    }

    this.filename = state().query.name || "files.zip";

    setPageTitle(this.filename);

    let sizeName = sizeToName(files.reduce((sum, cur) => sum+cur.size, 0))

    this.shadowRoot.getElementById('title').innerText = this.filename
    this.shadowRoot.getElementById('subtitle-count').innerText = files.length;
    this.shadowRoot.getElementById('subtitle-size').innerText = sizeName
  }

  async downloadFiles(){
    if(this.files.length < 1) return alertDialog("No files found");
    let {token} = await api.get("me/token")
    if(this.sourcePath){
      window.open(`${apiURL()}/${this.sourcePath}/file/query/dl?filter=${this.filter}&token=${token}&name=${this.filename}`)
    } else {
      window.open(`${apiURL()}/file/query/dl?filter=${this.filter}&token=${token}&name=${this.filename}`)
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