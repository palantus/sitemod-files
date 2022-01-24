const elementName = 'file-page'

import {state, siteURL, apiURL} from "/system/core.mjs"
import api from "/system/api.mjs"
import "/components/field-edit.mjs"
import "/components/field-ref.mjs"
import "/components/field-list.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import { promptDialog } from "../../components/dialog.mjs"
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
  </style>

  <action-bar>
    <action-bar-item id="download-btn">Download file</action-bar-item>
    <action-bar-item id="delete-btn">Delete file</action-bar-item>
  </action-bar>
    
  <div id="container">
    <h2>File: <span id="title"></span></h2>
    <field-list id="fields-list" labels-pct="25">
      <field-edit type="text" label="Name" id="name"></field-edit>
      <field-edit type="text" label="Mime type" id="mime"></field-edit>
      <field-edit type="text" label="Hash" id="hash" disabled></field-edit>
      <field-edit type="number" label="Size (bytes)" id="size" disabled></field-edit>
    </field-list>
    
    <h3 class="subheader">Tags:</h3>
    <table id="tagstab" class="datalist">
      <!--<thead>
      <tr><th>Tag</th><th></th></tr>
      </thead>-->
      <tbody id="tags">
      </tbody>
    </table>
    <button class="styled" id="add" title="Add tag">Add</button>

    <h3 class="subheader">Links:</h3>
    <field-list id="links-list" labels-pct="25">
      <field-edit type="text" label="Wiki reference" id="wiki-ref" disabled></field-edit>
      <field-edit type="text" label="Raw link" id="url-raw" disabled></field-edit>
      <field-edit type="text" label="Temp external (~2 days)" id="url-external" disabled></field-edit>
    </field-list>

    <h3 class="subheader">Preview:</h3>
    <div id="preview"></div>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.add = this.add.bind(this)
    this.click = this.click.bind(this)
    this.deleteFile = this.deleteFile.bind(this)
    this.downloadFile = this.downloadFile.bind(this)

    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deleteFile)
    this.shadowRoot.getElementById("download-btn").addEventListener("click", this.downloadFile)
    this.shadowRoot.getElementById("add").addEventListener("click", this.add)
    this.shadowRoot.getElementById("tags").addEventListener("click", this.click)

    this.fileId = /([\da-zA-Z]+)/.exec(state().path.split("/")[2])[0]
  }

  async refreshData(id = this.fileId){
    let file = this.file = await api.get(`file/${this.fileId}`)
    
    if(!file){
      alertDialog("Unknown file")
      return;
    }

    this.shadowRoot.getElementById('title').innerText = file.filename
    this.shadowRoot.getElementById('name').setAttribute("value", file.filename)
    this.shadowRoot.getElementById('mime').setAttribute("value", file.mime)
    this.shadowRoot.getElementById('size').setAttribute("value", file.size)
    this.shadowRoot.getElementById('hash').setAttribute("value", file.hash)
    this.shadowRoot.getElementById("tags").innerHTML = file.tags.map(tag => `
                  <tr>
                      <td>${tag}</td>
                      <td><button class="del">Remove</button></td>
                  </tr>`).join("")

    this.shadowRoot.getElementById('url-raw').setAttribute("value", file.links.raw)
    this.shadowRoot.getElementById('url-external').setAttribute("value", file.links.download)
    this.shadowRoot.getElementById('wiki-ref').setAttribute("value", `[${file.filename?.replace(/\_/g, "\\_")}](/file/${file.id})`)

    this.shadowRoot.getElementById("tagstab").classList.toggle("empty", file.tags.length < 1)
    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `file/${file.id}`));

    if(this.fileId != this.lastFileId){
      this.shadowRoot.getElementById("preview").innerHTML = ""
      switch(file.mime){
        case "image/gif":
        case "image/jpg":
        case "image/jpeg":
        case "image/png": {
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

        default: 
          this.shadowRoot.getElementById("preview").innerText = "No preview for mime type"
      }
    }
    this.lastFileId = this.fileId
  }
  
  async add(){
    let tag = await promptDialog("Enter tag")
    if(!tag) return;
    await api.post(`file/${this.fileId}/tags`, {tag})
    this.refreshData()
  }

  async click(e){
    if(e.target.tagName != "BUTTON") return;
    let tr = e.target.closest("tr");
    let tag = tr.querySelector("td:first-child").innerText
    if(!tag) return;
    await api.del(`file/${this.fileId}/tags/${tag}`)
    this.refreshData()
  }

  async deleteFile(){
    if(!await confirmDialog(`Are you sure that you want to delete file ${this.fileId}?`)) return;
    await api.del(`file/${this.fileId}`)
    window.history.back();
  }

  async downloadFile(){
    if(typeof window.showSaveFilePicker === "undefined") { //Firefox
      window.open(this.file.links?.download)
      return;
    }
    
    const options = {
      suggestedName: this.file.filename
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