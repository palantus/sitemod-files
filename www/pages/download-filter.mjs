const elementName = 'file-download-page'

import {state, setPageTitle, apiURL} from "/system/core.mjs"
import api from "/system/api.mjs"
import "/components/field-ref.mjs"
import { alertDialog } from "../../components/dialog.mjs"
import {sizeToName} from "./file.mjs"

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

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.downloadFiles = this.downloadFiles.bind(this)

    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFiles)
  }

  async refreshData(){
    this.filter = state().query.filter
    setPageTitle("");
    let src = this.federationSource = state().query.src
    let files = this.files = await api.get(src ? `federation/${src}/api/file/query?filter=${this.filter}` : `file/query?filter=${this.filter}`)
    
    if(files.length < 1){
      alertDialog("No files could not be found. Either they doesn't exist or you do not have access to any of them")
      return;
    }

    setPageTitle(`${files.length} files`);

    let sizeName = sizeToName(files.reduce((sum, cur) => sum+cur.size, 0))

    this.shadowRoot.getElementById('title').innerText = state().query.name || "files.zip"
    this.shadowRoot.getElementById('subtitle-count').innerText = files.length;
    this.shadowRoot.getElementById('subtitle-size').innerText = sizeName
  }

  async downloadFiles(){
    if(this.files.length < 1) return alertDialog("No files found");
    let {token} = await api.get("me/token")
    if(this.federationSource){
      window.open(`${apiURL()}/federation/${this.federationSource}/api/file/query/dl?filter=${this.filter}&token=${token}`)
    } else {
      window.open(`${apiURL()}/file/query/dl?filter=${this.filter}&token=${token}`)
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