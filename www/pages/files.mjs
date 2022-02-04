const elementName = 'files-page'

import {default as api, userPermissions} from "/system/api.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/field-ref.mjs"
import "/components/field.mjs"
import "/components/field-edit.mjs"
import {on, off, fire} from "/system/events.mjs"
import {state, pushStateQuery, apiURL} from "/system/core.mjs"
import {showDialog} from "/components/dialog.mjs"
import { alertDialog } from "../../components/dialog.mjs"
import { confirmDialog } from "../../components/dialog.mjs"
import "/components/data/searchhelp.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <link rel='stylesheet' href='/css/searchresults.css'>
  <style>
    #container{
        position: relative;
    }
    .hidden{display: none;}
    table{
      width: 100%;
    }
    table thead tr{
      border-bottom: 1px solid gray;
    }
    img.iconbtn{width: 15px; cursor: pointer; margin-right: 2px;}

    table thead th:nth-child(1){width: 25px}
    table thead th:nth-child(2){width: 450px}
    table thead th:nth-child(3){width: 70px}
    table thead th:nth-child(4){width: 100px}
    table thead th:nth-child(5){width: 150px}

    table th:nth-child(2), table td:nth-child(2){padding-left: 0px;}
  </style>  

  <action-bar>
      <action-bar-item id="new-btn" class="hidden">Upload file(s)</action-bar-item>
      <action-bar-item id="add-folder" class="hidden">Add folder</action-bar-item>
      <action-bar-item id="download-folder" title="Only downloads the files that are currently shown. It does not allow download of folders.">Download all files</action-bar-item>
      <action-bar-item id="delete-all-btn" class="hidden">Delete all</action-bar-item>
  </action-bar>

  <div id="container">
    <input id="search" type="text" placeholder="Enter query" value=""></input>
    <searchhelp-component path="file/searchhelp"></searchhelp-component>
    
    <table>
        <thead>
            <tr>
              <th></th>
              <th>Filename</th>
              <th>Size</th>
              <th>Mime / filter</th>
              <th>Tags</th>
              <th></th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    </table>
  </div>

  <dialog-component title="Upload file" id="new-dialog">
    <field-component label="Tags"><input id="new-tag" placeholder="tag1, tag2, ..."></input></field-component>
    <input type="file" multiple>
  </dialog-component>
  
  <dialog-component title="Add folder" id="add-folder-dialog">
    <field-component label="Name"><input id="add-name"></input></field-component>
    <field-component label="Filter"><input id="add-filter"></input></field-component>
  </dialog-component>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.addFolder = this.addFolder.bind(this);
    this.downloadFolder = this.downloadFolder.bind(this);
    this.queryChanged = this.queryChanged.bind(this);
    this.deleteAll = this.deleteAll.bind(this);
    this.tabClick = this.tabClick.bind(this)
    
    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.uploadFile)
    this.shadowRoot.getElementById("add-folder").addEventListener("click", this.addFolder)
    this.shadowRoot.getElementById("download-folder").addEventListener("click", this.downloadFolder)
    this.shadowRoot.getElementById("delete-all-btn").addEventListener("click", this.deleteAll)
    this.shadowRoot.querySelector('table tbody').addEventListener("click", this.tabClick)

    this.shadowRoot.getElementById('search').addEventListener("change", () => {
      this.queryChanged()
      pushStateQuery(this.lastQuery ? {filter: this.lastQuery} : undefined)
    })

    this.query = ""

    userPermissions().then(permissions => {
      if(permissions.includes("file.upload")){
        this.shadowRoot.getElementById("new-btn").classList.remove("hidden")
      }
      if(permissions.includes("file.edit")){
        this.shadowRoot.getElementById("add-folder").classList.remove("hidden")
        this.shadowRoot.getElementById("delete-all-btn").classList.remove("hidden")
      }
    })
  }
  async refreshData(){
    let result = await api.get(`file/query?filter=${this.lastQuery}`)
    if(!result) return this.shadowRoot.querySelector('table tbody').innerHTML = ''
    this.tags = result.tags;
    this.files = result.results;
    this.shadowRoot.querySelector('table tbody').innerHTML = result.results.sort((a, b) => {
      return a.type == b.type ? (a.filename?.toLowerCase() < b.filename?.toLowerCase() ? -1 : 1)
                              : a.type == "folder" ? -1 : 1
    }).map(f => `
        <tr class="result" data-id="${f.id}" data-name="${f.filename}">
          <td><img style="width: 20px;" src="/img/${f.type == "folder" ? "folder.svg" : "file.png"}"></td>
          <td><field-ref ref="${f.type == "folder" ? `/files?filter=folder:${f.id}` : `/file/${f.id}`}">${f.filename}</field-ref></td>
          <td>${f.size?`${Math.floor(f.size/1000)} KB`:""}</td>
          <td>${f.mime||f.filter||""}</td>
          <td>${f.tags.join(", ")}</td>
          <td>
            <img title="Edit" class="edit iconbtn" src="/img/edit.ico">
            <img title="Delete" class="delete iconbtn" src="/img/delete.png">
          </td>
        </tr>
      `).join("");

    this.shadowRoot.getElementById("add-folder").toggleAttribute("disabled", !this.isFolderView)
  }

  async queryChanged(q = this.shadowRoot.querySelector('input').value){
    if(q == this.lastQuery)
      return;

    q = q.toLowerCase() || "folder:"
    this.isFolderView = /folder\:\d*/.test(q)
    this.folder = this.isFolderView ? /folder\:(\d*)/.exec(q)[1]||"root" : null

    this.lastQuery = q;
    this.shadowRoot.querySelector('input').value = q;

    this.refreshData();
  }

  async uploadFile(){
    let dialog = this.shadowRoot.querySelector("#new-dialog")
    uploadNewFile(dialog, {tags: this.tags || [], callback: this.refreshData})
  }

  addFolder(){
    if(this.shadowRoot.getElementById("add-folder").hasAttribute("disabled")) return;
    if(!this.folder) return;

    let dialog = this.shadowRoot.getElementById("add-folder-dialog")
    
    showDialog(dialog, {
      show: () => this.shadowRoot.getElementById("add-name").focus(),
      ok: async (val) => {
        await api.post(`file/${this.folder}/folders`, val)
        this.refreshData()
      },
      validate: (val) => 
          !val.name ? "Please fill out name"
        : true,
      values: () => {return {
        name: this.shadowRoot.getElementById("add-name").value,
        filter: this.shadowRoot.getElementById("add-filter").value,
      }},
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  async downloadFolder(){
    if(typeof window.showSaveFilePicker === "undefined") {
      let {token} = await api.get("me/token")
      window.open(`${apiURL()}/file/query/dl?filter=${this.lastQuery}&token=${token}`)
      return;
    }
    
    const options = {
      types: [
        {
          description: 'Zip Files',
          accept: {
            'application/zip': ['.zip'],
          },
        },
      ],
    };

    let filePickerPromise = window.showSaveFilePicker(options);
    let file = await (await api.fetch(`file/query/dl?filter=${this.lastQuery}`)).blob()
    const newHandle = await filePickerPromise;
    const writableStream = await newHandle.createWritable();
    await writableStream.write(file);
    await writableStream.close();
  }

  async deleteAll(){
    if(!await confirmDialog(`Are you sure that you want to delete ALL files currently listed (filter "${this.lastQuery}")?`)) return;
    await api.del(`file/query?filter=${this.lastQuery}`)
    this.refreshData()
  }

  async tabClick(e){
    if(e.target.tagName != "IMG") return;
    let tr = e.target.closest("tr");
    let id = tr.getAttribute("data-id")
    let name = tr.getAttribute("data-name")
    if(e.target.classList.contains("delete")){
      if(!await confirmDialog(`Are you sure that you want to delete file ${name} (${id})?`)) return;
      await api.del(`file/${id}`)
      this.refreshData()
    } else if(e.target.classList.contains("edit")){
      this.editRowClicked(e.target, tr, id)
    }
  }

  editRowClicked(img, tr, id){
    let tdName = tr.querySelector("td:nth-child(2)")
    let tdFilter = tr.querySelector("td:nth-child(4)")
    let tdTags = tr.querySelector("td:nth-child(5)")
    let fileObj = this.files.find(t => t.id == id)

    if(tr.hasAttribute("edit-mode")){
      tr.removeAttribute("edit-mode")

      fileObj.filename = tdName.querySelector("field-edit").getValue()
      tdName.innerHTML = `<field-ref ref="${fileObj.type == "folder" ? `/files?filter=folder:${fileObj.id}` : `/file/${fileObj.id}`}">${fileObj.filename}</field-ref>`

      if(fileObj.type == "folder"){
        fileObj.filter = tdFilter.querySelector("field-edit").getValue()
        tdFilter.innerText = fileObj.filter
      }

      fileObj.tags = tdTags.querySelector("field-edit").getValue().split(",").map(t => t.trim())
      tdTags.innerHTML = fileObj.tags.join(", ")

      img.src = "/img/edit.ico"
    } else {
      tr.setAttribute("edit-mode", "true")

      tdName.innerHTML = `<field-edit type="text" value="${fileObj.filename}" patch="file/${id}" field="filename"></field-edit>`
      if(fileObj.type == "folder"){
        tdFilter.innerHTML = `<field-edit type="text" value="${fileObj.filter||""}" patch="file/${id}" field="filter"></field-edit>`
      }
      tdTags.innerHTML = `<field-edit type="text" value="${fileObj.tags.join(", ")}" patch="file/${id}" field="tags"></field-edit>`
      img.src = "/img/cancel.svg"
    }
  }

  connectedCallback() {
    this.shadowRoot.getElementById('search').focus();
    this.queryChanged(state().query.filter||"");
    on("changed-project", elementName, this.refreshData)
    on("changed-page", elementName, this.refreshData)
    on("changed-page-query", elementName, (query) => this.queryChanged(query.filter || ""))
  }

  disconnectedCallback() {
    off("changed-project", elementName)
    off("changed-page", elementName)
    off("changed-page-query", elementName)
  }
}

export async function uploadNewFile(dialog, {tags = [], callback} = {}){
  showDialog(dialog, {
    show: () => {
      dialog.querySelector("#new-tag").focus();
      dialog.querySelector("#new-tag").value = tags.join(", ");
    },
    ok: async (val) => {
      let formData = new FormData();
      for(let file of dialog.querySelector("input[type=file]").files)
        formData.append("file", file);
      let tags = val.tag.split(",").map(t => t.trim())
      let files = await api.upload(`/file/tag/${tags[0]}/upload`, formData);
      if(tags.length > 1){
        for(let f of files){
          await api.patch(`file/${f.id}`, {tags})
        }
      }
      if(typeof callback === "function") 
        callback(val);
    },
    validate: (val) => 
        !val.tag ? "Please fill out tag"
      : true,
    values: () => {return {
      tag: dialog.querySelector("#new-tag").value,
    }},
    close: () => {
      dialog.querySelectorAll("field-component input").forEach(e => e.value = '')
    }
  })
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}