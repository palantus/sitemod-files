const elementName = 'file-page'

import {state, setPageTitle} from "/system/core.mjs"
import api from "/system/api.mjs"
import {userPermissions} from "/system/user.mjs"
import "/components/field-edit.mjs"
import "/components/field-ref.mjs"
import "/components/field-list.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/acl.mjs"
import "/pages/tools/inspect-ld.mjs"
import { confirmDialog } from "../../components/dialog.mjs"
import { alertDialog } from "../../components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <link rel='stylesheet' href='/css/global.css'>
  <style>
    #container{
      padding: 10px;
    }
    #fields-list{
      width: 400px;
    }
    #links-list{
      max-width: 800px;
    }
    h3{margin-top: 20px;}
    .subheader{text-decoration: underline;}
    #preview object{
      width: 100%;
      height: 500px;
    }
    #preview img{
      width: 100%;
    }
    .hidden{display: none;}
  </style>

  <action-bar>
    <action-bar-item id="download-btn">Download</action-bar-item>
    <action-bar-item id="delete-btn" class="hidden">Delete</action-bar-item>
  </action-bar>
    
  <div id="container">
    <h2><span id="title-type"></span>: <span id="title"></span></h2>
    <field-list id="fields-list" labels-pct="25">
      <field-edit type="text" label="Name" id="name"></field-edit>
      <field-edit type="text" label="In folder" id="parentPath" disabled></field-edit>
      <field-edit type="text" label="Created" id="created" disabled></field-edit>
      <field-edit type="text" label="Modified" id="modified" disabled></field-edit>
      <field-edit type="text" label="Tags" id="tags"></field-edit>
      <field-edit type="text" label="Mime type" id="mime"></field-edit>
      <field-edit type="text" label="Hash" id="hash" disabled></field-edit>
      <field-edit type="text" label="Size" id="size" disabled></field-edit>
      <field-edit type="text" label="Wiki reference" id="wiki-ref" disabled></field-edit>
    </field-list>

    <br>
    <acl-component id="acl" rights="rw" disabled></acl-component>
  
    <div id="preview-container" class="hidden">
      <h3 class="subheader">Preview:</h3>
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

    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deleteFile)
    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)

    this.fileId = /([\da-zA-Z]+)/.exec(state().path.split("/")[2])[0]
  }

  async refreshData(id = this.fileId){
    setPageTitle("");
    let file = this.file = await api.get(`file/${this.fileId}`)
    
    if(!file){
      alertDialog("This file or folder could not be found. Either it doesn't exist or you do not have access to it")
      return;
    }

    setPageTitle(file.name);
    
    this.shadowRoot.getElementById('title-type').innerText = file.type == "folder" ? "Folder" : "File"
    this.shadowRoot.getElementById('title').innerText = file.name
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

    let permissions = await userPermissions()
    if((permissions.includes("file.edit") && file.rights.includes("w")) || permissions.includes("admin")){
      this.shadowRoot.getElementById("delete-btn").classList.remove("hidden")
    }

    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `file/${file.id}`));

    this.shadowRoot.getElementById("preview-container").classList.toggle("hidden", file.type != "file")

    if(file.type == "file" && this.fileId != this.lastFileId){
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
          case "text/plain": {
            let res = await api.fetch(`file/dl/${this.fileId}`)
            let text = await res.text()
            let div = document.createElement("pre")
            div.innerText = text
            this.shadowRoot.getElementById("preview").appendChild(div)
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

          default: 
            this.shadowRoot.getElementById("preview").innerText = "No preview for mime type"
        }
      }
    }
    this.lastFileId = this.fileId

    this.shadowRoot.getElementById("acl").setAttribute("type", file.type)
    this.shadowRoot.getElementById("acl").setAttribute("entity-id", this.fileId)
    setTimeout(() => this.shadowRoot.getElementById("acl").removeAttribute("disabled"), 100)
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

window.customElements.define(elementName, Element);
export {Element, elementName as name}