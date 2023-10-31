const elementName = 'file-actions-component'

import {goto, stylesheets} from "../system/core.mjs"
import api from "../system/api.mjs"
import {getFileActions} from "../libs/actions.mjs"
import {userPermissions} from "../system/user.mjs"
import {alertDialog, showDialog} from "../components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `

  <style>
    .hidden{display: none;}
    #actions-container{margin-top: 10px;}
    #action-component-container{margin-top: 10px;}
  </style>

  <div id="container">
    <div id="actions-container" class="hidden">
    </div>

    <div id="action-component-container" class="hidden">
    </div>

    <dialog-component id="action-dialog"></dialog-component>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' })
        .adoptedStyleSheets = [stylesheets.global];
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.actionsClick = this.actionsClick.bind(this)

    this.shadowRoot.getElementById("actions-container").addEventListener("click", this.actionsClick)

    this.fileId = this.getAttribute("file-id")
    this.federationId = this.getAttribute("federation-id")
  }

  async refreshData(id = this.fileId){
    if(!id) return;
    let file = this.file = await api.get(this.federationId ? `federation/${this.federationId}/api/file/${this.fileId}` : `file/${this.fileId}`)
    
    if(!file){
      return;
    }

    let actions = getFileActions(file.mime);
    this.shadowRoot.getElementById("actions-container").classList.toggle("hidden", actions.length == 0)
    this.shadowRoot.getElementById("action-component-container").classList.toggle("hidden", true);
    let permissions = await userPermissions()
    this.shadowRoot.getElementById("actions-container").innerHTML = actions
                            .filter(a => !a.access || file.rights.includes(a.access))
                            .filter(a => !a.permission || permissions.includes(a.permission))
                            .map(a => `<button class="styled" data-action-id="${a.id}">${a.title}</button>`).join("")
  }

  actionsClick(e){
    let id = e.target.getAttribute("data-action-id")
    if(!id) return;


    let action = getFileActions(this.file.mime).find(a => a.id == id);
    if(!action) return;

    if(action.gotoPath){
      goto(`${action.gotoPath}?file-id=${this.file.id}${this.federationId?`&federation-id=${this.federationId}`:''}`)
    } else if(action.componentName){
      if(!this.shadowRoot.getElementById("action-component-container").classList.contains("hidden")){
        this.refreshData()
        return;
      }
      let container = this.shadowRoot.getElementById("action-component-container");
      import(action.componentPath).then(() => {
        container.innerHTML = `<${action.componentName} file-id="${this.file.id}" federation-id="${this.federationId||''}"></${action.componentName}>`
        container.classList.toggle("hidden", false)
      })
    } else if(action.dialog){
      let container = document.createElement("div")
      container.innerHTML = `<dialog-component></dialog-component>`
      document.getElementById("body-container").appendChild(container)
      let dialog = container.querySelector("dialog-component")
      dialog.innerHTML = action.dialog.html || ""
      if(!action.dialog.options.data) action.dialog.options.data = {};
      action.dialog.options.data.file = this.file;
      showDialog(dialog, action.dialog.options)
    } else {
      alertDialog("Invalid action")
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