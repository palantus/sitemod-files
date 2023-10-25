const elementName = 'drop-page'

import {siteURL} from "../system/core.mjs"
import api from "../system/api.mjs"
import "../components/field-edit.mjs"
import "../components/field-ref.mjs"
import "../components/field-list.mjs"
import "../components/action-bar.mjs"
import "../components/action-bar-item.mjs"
import "../components/acl.mjs"
import "../components/progress.mjs"
import { confirmDialog } from "../../components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <link rel='stylesheet' href='/css/global.css'>
  <style>
    #container{
      padding: 10px;
    }
    #header{
      padding-bottom: 10px;
    }
    
    #fileupload{
      margin-bottom: 10px;
    }
    
    #uploadbutton{
      width: 100%;
      background-color: #f44336;
      border: none;
      color: white;
      padding: 15px 32px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      cursor: pointer;
      margin-top: 10px;
    }
    
    #uploadbutton.is-dragover{
      background-color: gray;
    }
    
    #filestable th:nth-child(1){min-width: 250px;}
    #filestable th:nth-child(2){min-width: 75px;}
    #filestable th:nth-child(3){min-width: 100px;}
    #filestable th:nth-child(4){min-width: 276px;}
    
    #filestable td, #filestable th{
      border-bottom: 1px solid;
      padding: 5px;
      text-align: left;
    }
    
    #filestable td a{
      padding-right: 5px;
    }
    .hidden{display: none;}
  </style>
  
  <action-bar>
      <action-bar-item id="delete-all-btn">Delete all</action-bar-item>
      <action-bar-item id="copy-drop-link-btn">Copy personal link</action-bar-item>
  </action-bar>  

  <div id="container">
    <form id="fileupload">
      <table>
        <tr>
          <td colspan="2" id="header"><h2>File Drop</h2></td>
        </tr>
        <tr>
          <th>Select File: </th>
          <td><input id="chosenfile" name="csv" type="file" multiple/></td>
        </tr>
        <tr>
          <td colspan="2">
            <input type="submit" value="Begin Upload!" id="uploadbutton"/>
          </td>
        </tr>
        <tr class="hidden">
          <td colspan="2">
            <progress-bar complete-text="Upload complete!"></progress-bar>
          </td>
        </tr>
      </table>
    </form>

    <table id="filestable" cellspacing="0">
      <thead>
        <tr>
          <th>Filename</th>
          <th></th>
          <th>Delete date</th>
        </tr>
      </thead>
      <tbody id="uploadedfiles">
      </tbody>
    </table>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.pasteHandler = this.pasteHandler.bind(this)
    this.dragStart = this.dragStart.bind(this)
    this.dragEnd = this.dragEnd.bind(this)
    this.drop = this.drop.bind(this)
    this.submitFile = this.submitFile.bind(this)
    this.refreshData = this.refreshData.bind(this)
    this.dropsClick = this.dropsClick.bind(this)

    let uploadButton = this.shadowRoot.getElementById("uploadbutton");
    'drag dragstart dragend dragover dragenter dragleave drop'.split(" ").forEach(e => uploadButton.addEventListener(e, this.preventDef));
    'dragover dragenter'.split(" ").forEach(e => uploadButton.addEventListener(e, this.dragStart));
    'dragleave dragend drop'.split(" ").forEach(e => uploadButton.addEventListener(e, this.dragEnd));
    uploadButton.addEventListener("drop", this.drop)
    this.shadowRoot.getElementById("fileupload").addEventListener("submit", this.submitFile)

    this.shadowRoot.getElementById("delete-all-btn").addEventListener("click", () => confirmDialog("Are you sure that you want to delete all dropped files?").then(answer => answer ? api.del("file/drop/all").then(this.refreshData) : null))
    this.shadowRoot.getElementById("copy-drop-link-btn").addEventListener("click", () => api.get("me/token").then(({token}) => navigator.clipboard.writeText(`${siteURL()}/drop?token=${token}`)))
    this.shadowRoot.getElementById("uploadedfiles").addEventListener("click", this.dropsClick)
  }

  async refreshData(){
    let files = await api.get("file/drop")
    this.shadowRoot.getElementById("uploadedfiles").innerHTML = files.reverse()
                                                                     .map(f => `
      <tr>
        <td><field-ref ref="/file/${f.id}">${f.name}</field-ref></td>
        <td>
          <button class="copy-link" data-url="${f.dropLink}">Copy link</button>
          <button class="copy-hash" data-hash="${f.hash}">Copy hash</button>
        </td>
        <td>${f.expirationDate?.substring(0, 10)||""}</td>
      </tr>`).join("")
  }

  async pasteHandler(e) {
    if (!e.clipboardData)
      return;

    let items = e.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          let blob = items[i].getAsFile();
          let formData = new FormData();
          formData.append("image", blob);
          this.doUploadFile(formData);
        } else if (items[i].type.indexOf("text") !== -1) {
          let content = await new Promise((r) => items[i].getAsString((s) => r(s)));
          let blob = new Blob([content], { type: "text/plain;charset=utf-8" });
          let formData = new FormData();
          formData.append("text", blob, "text.txt");
          this.doUploadFile(formData);
        }
      }
    }
  }

  dragStart(){
    this.shadowRoot.getElementById("uploadbutton").classList.add('is-dragover');
  }

  dragEnd(){
    this.shadowRoot.getElementById("uploadbutton").classList.remove('is-dragover');
  }

  preventDef(e){
    e.preventDefault();
    e.stopPropagation();
  }

  drop(e){
    let droppedFiles = e.dataTransfer.files;
    for(let f of droppedFiles){
      let formData = new FormData();
      formData.append(f.name, f);
      this.readFile(f, formData);
    }
  }

  submitFile(e){
    e.preventDefault();
    this.fileUploadClicked(e.target)
    return false;
  }

  fileUploadClicked(form){
    let formData = new FormData(form);
    let filesChosen = this.shadowRoot.getElementById("chosenfile");
    for(let file of filesChosen.files){
      this.readFile(file, formData)
    }
  }

  readFile(file, formData){
    let reader = new FileReader();
    reader.onloadend = (event) => this.doUploadFile(formData)
    reader.readAsBinaryString(file);
  }

  async doUploadFile(formData){
    let progressBar = this.shadowRoot.querySelector("progress-bar")
    progressBar.closest("tr").classList.remove("hidden")
    let files = await api.upload(`file/drop`, formData, {onProgress: value => progressBar.setAttribute("value", value)});
    setTimeout(() => progressBar.closest("tr").classList.add("hidden"), 1000);
    this.refreshData();
  }
  
  dropsClick(e){
    if(e.target.classList.contains("copy-link")){
      navigator.clipboard.writeText(e.target.getAttribute("data-url"))
    } else if(e.target.classList.contains("copy-hash")){
      navigator.clipboard.writeText(e.target.getAttribute("data-hash"))
    }
  }

  connectedCallback() {
    this.refreshData(this.fileId);
    window.addEventListener("paste", this.pasteHandler);
  }

  disconnectedCallback() {
    window.removeEventListener("paste", this.pasteHandler);
  }

}

window.customElements.define(elementName, Element);
export { Element, elementName as name }