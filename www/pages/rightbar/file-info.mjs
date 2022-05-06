const elementName = 'rightbar-file-info-component'

import api from "/system/api.mjs"
import "/components/field.mjs"
import "/components/field-edit.mjs"
import "/components/field-list.mjs"
import {on, off} from "/system/events.mjs"
import { closeRightbar } from "/pages/rightbar/rightbar.mjs"
import {goto, state} from "/system/core.mjs"
import { confirmDialog } from "/components/dialog.mjs"
import "/components/acl.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <style>
    #container{color: white; padding: 10px;}
    h2{margin: 0px; border-bottom: 1px solid lightgray; padding-bottom: 5px; margin-bottom: 10px;}
    #close{margin-top: 10px;}
    table{width: 100%;}
    table td:first-child{width: 80px;}
    .hidden{display: none;}
  </style>
  <div id="container">
      <h2>Information</h2>

      <table>
        <tr><td>Name:</td><td><field-edit type="text" id="name"></field-edit></td></tr>
        <tr><td>In folder:</td><td><field-edit type="text" id="parentPath" disabled></field-edit></td></tr>
        <tr><td>Created:</td><td><field-edit type="text" id="created" disabled></field-edit></td></tr>
        <tr><td>Modified:</td><td><field-edit type="text" id="modified" disabled></field-edit></td></tr>
        <tr><td>Tags:</td><td><field-edit type="text" id="tags"></field-edit></td></tr>
        <tr><td>Mime type:</td><td><field-edit type="text" id="mime"></field-edit></td></tr>
        <tr><td>Hash:</td><td><field-edit type="text" id="hash" disabled></field-edit></td></tr>
        <tr><td>Size:</td><td><field-edit type="text" id="size" disabled></field-edit></td></tr>
        <tr><td>Wiki ref.:</td><td><field-edit type="text" id="wiki-ref" disabled></field-edit></td></tr>
      </table>


      <button id="download-btn">Download</button>
      <button id="show-btn">Show info page</button>
      <button id="close">Close</button>

      <br>
      <br>
      <h2>Permissions</h2>

      <acl-component id="acl" rights="rw" disabled always-show></acl-component>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.shadowRoot.getElementById("close").addEventListener("click", () => closeRightbar())
    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)
    this.shadowRoot.getElementById("show-btn").addEventListener("click", () => goto(`/file/${this.file.id}`))
  }

  async refreshData(){
    this.fileId = this.getAttribute("fileid")
    if(!this.fileId) return;

    this.shadowRoot.getElementById("show-btn").classList.toggle("hidden", this.hasAttribute("hideInfoButton"))
    if(this.hasAttribute("type")){
      this.refreshUIFromType(this.getAttribute("type"))
    }
    let file = this.file = await api.get(`file/${this.fileId}`)

    this.shadowRoot.getElementById('name').setAttribute("value", file.name)
    this.shadowRoot.getElementById('parentPath').setAttribute("value", file.parentPath||"<none>")
    this.shadowRoot.getElementById('created').setAttribute("value", file.created?.replace("T", " ").substring(0, 19) || "")
    this.shadowRoot.getElementById('modified').setAttribute("value", file.modified?.replace("T", " ").substring(0, 19) || "<never>")
    this.shadowRoot.getElementById('tags').setAttribute("value", file.tags.join(", "))
    this.shadowRoot.getElementById('wiki-ref').setAttribute("value", `[${file.name?.replace(/\_/g, "\\_")}](/${file.type}/${file.id})`)

    if(file.type == "file"){
      this.shadowRoot.getElementById('mime').setAttribute("value", file.mime)

      let sizeName = file.size < 1000 ? `${file.size} bytes`
                   : file.size < 1000000 ? `${Math.floor(file.size/1000)} KB`
                   : `${Math.floor(file.size/1000000)} MB`

      this.shadowRoot.getElementById('size').setAttribute("value", sizeName)
      this.shadowRoot.getElementById('hash').setAttribute("value", file.hash)
    }

    this.refreshUIFromType(file.type)

    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `file/${file.id}`));

    this.shadowRoot.getElementById("acl").setAttribute("type", file.type)
    this.shadowRoot.getElementById("acl").setAttribute("entity-id", this.fileId)
    setTimeout(() => this.shadowRoot.getElementById("acl").removeAttribute("disabled"), 100)
  }

  refreshUIFromType(type){
    this.shadowRoot.getElementById('mime').closest("tr").classList.toggle("hidden", type != "file")
    this.shadowRoot.getElementById('size').closest("tr").classList.toggle("hidden", type != "file")
    this.shadowRoot.getElementById('hash').closest("tr").classList.toggle("hidden", type != "file")
    this.shadowRoot.getElementById('modified').closest("tr").classList.toggle("hidden", type != "file")
   
    this.shadowRoot.getElementById('download-btn').classList.toggle("hidden", type != "file")
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

  static get observedAttributes() {
    return ['fileid'];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'fileid':
        this.refreshData()
        break;
    }
  }

  connectedCallback() {
    on("changed-page", elementName, () => closeRightbar())
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}