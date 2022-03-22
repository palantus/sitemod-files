const elementName = 'rightbar-file-info-component'

import api from "/system/api.mjs"
import "/components/field.mjs"
import "/components/field-edit.mjs"
import "/components/field-list.mjs"
import {on, off} from "/system/events.mjs"
import { closeRightbar } from "/pages/rightbar/rightbar.mjs"
import {goto, state} from "/system/core.mjs"
import { confirmDialog } from "/components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <style>
    #container{color: white; padding: 10px;}
    h2{margin: 0px; border-bottom: 1px solid lightgray; padding-bottom: 5px; margin-bottom: 10px;}
    #close{margin-top: 10px;}
    #fields-list{
      width: 270px;
    }
    .hidden{display: none;}
  </style>
  <div id="container">
      <h2>Information pane</h2>

      <field-list id="fields-list" labels-pct="35">
        <field-edit type="text" label="Name" id="name"></field-edit>
        <field-edit type="text" label="In folder" id="parentPath" disabled></field-edit>
        <field-edit type="text" label="Created" id="created" disabled></field-edit>
        <field-edit type="text" label="Modified" id="modified" disabled></field-edit>
        <field-edit type="text" label="Tags" id="tags"></field-edit>
        <field-edit type="text" label="Mime type" id="mime"></field-edit>
        <field-edit type="text" label="Hash" id="hash" disabled></field-edit>
        <field-edit type="text" label="Size" id="size" disabled></field-edit>
        <field-edit type="text" label="Wiki ref." id="wiki-ref" disabled></field-edit>
        </field-list>

      <button id="download-btn">Download</button>
      <button id="show-btn">Show info page</button>
      <button id="close">Close</button>
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

    this.shadowRoot.getElementById('mime').parentElement.classList.toggle("hidden", file.type != "file")
    this.shadowRoot.getElementById('size').parentElement.classList.toggle("hidden", file.type != "file")
    this.shadowRoot.getElementById('hash').parentElement.classList.toggle("hidden", file.type != "file")
    this.shadowRoot.getElementById('modified').parentElement.classList.toggle("hidden", file.type != "file")

    this.shadowRoot.getElementById('download-btn').classList.toggle("hidden", file.type != "file")

    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `file/${file.id}`));
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
    this.refreshData();
    on("changed-page", elementName, () => closeRightbar())
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}