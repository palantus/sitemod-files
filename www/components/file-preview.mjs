const elementName = 'file-preview-component'

import api from "/system/api.mjs"
import {sizeToName} from "../pages/file.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <link rel='stylesheet' href='/css/global.css'>
  <style>
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
    #subtitle-size, #subtitle-owner, #subtitle-modified{color: var(--accent-color-light);}
    video{width: 100%;}
  </style>

  <div id="container">
    <div id="actions-container" class="hidden">
    </div>

    <div id="action-component-container" class="hidden">
    </div>
    
    <div id="preview-container">
      <div id="preview"></div>
    </div>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.fileId = this.getAttribute("file-id")
    this.federationId = this.getAttribute("federation-id")
  }

  async refreshData(id = this.fileId){
    if(id != this.lastFileId) this.shadowRoot.getElementById("preview").innerHTML = "";
    if(!id) return;

    let file = this.file = await api.get(this.federationId ? `federation/${this.federationId}/api/file/${this.fileId}` : `file/${this.fileId}`)
    
    if(!file){
      this.shadowRoot.getElementById("preview").innerText = "This file or folder could not be found. Either it doesn't exist or you do not have access to it";
      return;
    }

    this.shadowRoot.getElementById("preview-container").classList.toggle("hidden", file.type != "file")

    let fileDate = (file.modified||file.created||"");
    if(file.type == "file" && (this.fileId != this.lastFileId || this.lastFileDate != fileDate)){
      this.refreshPreview();
    }
    this.lastFileId = this.fileId
    this.lastFileDate = fileDate
  }

  async refreshPreview(){
    let file = this.file
    let downloadUrl = this.federationId ? `federation/${this.federationId}/api/file/dl/${this.fileId}` : `file/dl/${this.fileId}`
    this.shadowRoot.getElementById("preview").innerHTML = ""
    if(file.type != "file") return;
    switch(file.mime){
      case "image/gif":
      case "image/jpg":
      case "image/jpeg":
      case "image/png":
      case "image/svg+xml": {
        let res = await api.fetch(downloadUrl)
        let blob = await res.blob()
        let objectURL = URL.createObjectURL(blob);
        let img = document.createElement("img")
        img.src = objectURL
        this.shadowRoot.getElementById("preview").appendChild(img)
        break;
      }

      case "application/pdf": {
        let res = await api.fetch(downloadUrl)
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
        let res = await api.fetch(downloadUrl)
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
        let res = await api.fetch(downloadUrl)
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

      case "application/zip": {
        this.shadowRoot.getElementById("preview").innerHTML = "<p>Loading preview...</p>"
        let res = await api.fetch(downloadUrl)
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

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        let res = await api.fetch(downloadUrl)
        let arrayBuffer = await res.arrayBuffer();
        let div = document.createElement("div")
        await import("/libs/mammoth.browser.min.js")
        let mammoth = window.mammoth;
        let result = await mammoth.convertToHtml({arrayBuffer})
        div.innerHTML = result.value;
        this.shadowRoot.getElementById("preview").appendChild(div)
        break;
      }

      default: 
        this.shadowRoot.getElementById("preview").innerText = "No preview for this file type"
    }
  }
    
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name){
      case "file-id":
        this.fileId = newValue;
        this.refreshData();
        break;
      case "federation-id":
        this.federationId = newValue;
        this.refreshData();
        break;
    }
  }

  static get observedAttributes() {
    return ["file-id", "federation-id"];
  } 

  connectedCallback() {
    this.refreshData(this.fileId);
  }

  disconnectedCallback() {
  }

}

window.customElements.define(elementName, Element);
export {Element, elementName as name}