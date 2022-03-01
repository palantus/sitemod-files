const elementName = 'file-sources-page'

import {state, apiURL} from "/system/core.mjs"
import api from "/system/api.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/field-ref.mjs"
import "/components/field-edit.mjs"
import "/components/field.mjs"
import {showDialog} from "/components/dialog.mjs"
import {on, off, fire} from "/system/events.mjs"
import { promptDialog } from "../../components/dialog.mjs"
import { confirmDialog } from "../../components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
        position: relative;
    }
    table{
      width: 100%;
    }
    table thead tr{
      border-bottom: 1px solid gray;
    }

    table thead th:nth-child(1){width: 75px}
    #new-dialog field-component input{width:250px;}
  </style>  

  <action-bar>
      <action-bar-item id="new-btn">New Source</action-bar-item>
      <action-bar-item id="download-btn">Download file</action-bar-item>
      <action-bar-item id="find-btn">Find file</action-bar-item>
      <action-bar-item id="debug-btn">Debug file</action-bar-item>
  </action-bar>

  <div id="container">
    <table>
        <thead>
            <tr>
              <th>Id</th>
              <th>Title</th>
              <th>Exists URL</th>
              <th>Download URL</th>
              <th>Details URL</th>
              <th>API Key Param</th>
              <th></th>
            </tr>
        </thead>
        <tbody id="tagsbody">
        </tbody>
    </table>
  </div>

  <dialog-component title="New File Source" id="new-dialog">
    <field-component label="Title"><input id="new-title"></input></field-component>
    <field-component label="Exists URL"><input id="new-existsUrl"></input></field-component>
    <field-component label="Download URL"><input id="new-downloadUrl"></input></field-component>
    <field-component label="Details URL"><input id="new-detailsUrl"></input></field-component>
    <field-component label="API Key Parm"><input id="new-apiKeyParm"></input></field-component>
  </dialog-component>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    this.tableClick = this.tableClick.bind(this)
    this.newSource = this.newSource.bind(this)
    
    this.shadowRoot.getElementById("tagsbody").addEventListener("click", this.tableClick)
    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.newSource)
    this.shadowRoot.getElementById("download-btn").addEventListener("click", async () => {
      let hash = await promptDialog("Enter hash")
      if(!hash) return;
      window.open(`${apiURL()}/filesource/download/${hash}`)
    })
    this.shadowRoot.getElementById("find-btn").addEventListener("click", async () => {
      let hash = await promptDialog("Enter hash")
      if(!hash) return;
      window.open(`${apiURL()}/filesource/file/${hash}`)
    })
    this.shadowRoot.getElementById("debug-btn").addEventListener("click", async () => {
      let hash = await promptDialog("Enter hash")
      if(!hash) return;
      window.open(`${apiURL()}/filesource/check/${hash}`)
    })

    this.refreshData();
  }

  async refreshData(){
    this.sources = await api.get("filesource")

    this.shadowRoot.querySelector('table tbody').innerHTML = this.sources.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${s.title}</td>
                <td>${s.existsUrl||""}</td>
                <td>${s.downloadUrl||""}</td>
                <td>${s.detailsUrl||""}</td>
                <td>${s.apiKeyParm||""}</td>
                <td><button class="edit">Edit</button><button class="delete">Delete</button></td>
            </tr>
        `).join("")
  }

  tableClick(e){
    if(e.target.tagName != "BUTTON") return;
    let tr = e.target.closest("tr");
    let id = tr.querySelector("td:first-child").innerText

    switch(e.target.className){
      case "edit":
        this.editRowClicked(e.target, tr, id)
        break;
      case "delete":
        this.deleteRowClicked(tr, id)
        break;
    }
  }

  editRowClicked(button, tr, id){
    let tdTitle = tr.querySelector("td:nth-child(2)")
    let tdExistsUrl = tr.querySelector("td:nth-child(3)")
    let tdDownloadUrl = tr.querySelector("td:nth-child(4)")
    let tdDetailsUrl = tr.querySelector("td:nth-child(5)")
    let tdApiKeyParm = tr.querySelector("td:nth-child(6)")
    let source = this.sources.find(t => t.id == id)

    if(tr.hasAttribute("edit-mode")){
      tr.removeAttribute("edit-mode")

      tdTitle.innerText = source.title = tdTitle.querySelector("field-edit").getValue()
      tdExistsUrl.innerText = source.existsUrl = tdExistsUrl.querySelector("field-edit").getValue() || ""
      tdDownloadUrl.innerText = source.downloadUrl = tdDownloadUrl.querySelector("field-edit").getValue() || ""
      tdDetailsUrl.innerText = source.detailsUrl = tdDetailsUrl.querySelector("field-edit").getValue() || ""
      tdApiKeyParm.innerText = source.apiKeyParm = tdApiKeyParm.querySelector("field-edit").getValue() || ""

      button.innerText = "Edit"
    } else {
      tr.setAttribute("edit-mode", "true")

      tdTitle.innerHTML = `<field-edit type="text" value="${source.title}" patch="filesource/${id}" field="title"></field-edit>`
      tdExistsUrl.innerHTML = `<field-edit type="text" value="${source.existsUrl || ""}" patch="filesource/${id}" field="existsUrl"></field-edit>`
      tdDownloadUrl.innerHTML = `<field-edit type="text" value="${source.downloadUrl || ""}" patch="filesource/${id}" field="downloadUrl"></field-edit>`
      tdDetailsUrl.innerHTML = `<field-edit type="text" value="${source.detailsUrl || ""}" patch="filesource/${id}" field="detailsUrl"></field-edit>`
      tdApiKeyParm.innerHTML = `<field-edit type="text" value="${source.apiKeyParm || ""}" patch="filesource/${id}" field="apiKeyParm"></field-edit>`
      button.innerText = "Exit edit mode"
    }
  }

  async deleteRowClicked(tr, id){
    if(!await confirmDialog(`Are you sure that you want to delete file source ${id}?`)) return;
    await api.del(`filesource/${id}`)
    tr.style.display = "none"
  }

  async newSource(){
    let dialog = this.shadowRoot.querySelector("#new-dialog")

    showDialog(dialog, {
      show: () => this.shadowRoot.querySelector("#new-title").focus(),
      ok: async (val) => {
        await api.post("filesource", val)
        this.refreshData()
      },
      validate: (val) => 
          !val.title ? "Please fill out title"
        : !val.downloadUrl ? "Please fill out download url"
        : true,
      values: () => {return {
        title: this.shadowRoot.getElementById("new-title").value,
        existsUrl: this.shadowRoot.getElementById("new-existsUrl").value,
        downloadUrl: this.shadowRoot.getElementById("new-downloadUrl").value,
        detailsUrl: this.shadowRoot.getElementById("new-detailsUrl").value,
        apiKeyParm: this.shadowRoot.getElementById("new-apiKeyParm").value,
      }},
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  connectedCallback() {
    on("changed-project", elementName, this.refreshData)
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-project", elementName)
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}