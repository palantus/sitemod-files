const elementName = 'files-page'

import api from "/system/api.mjs"
import {userPermissions, user} from "/system/user.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/field-ref.mjs"
import "/components/field.mjs"
import "/components/field-edit.mjs"
import "/components/acl.mjs"
import "/components/action-bar-menu.mjs"
import {on, off, fire} from "/system/events.mjs"
import {state, apiURL, setPageTitle, goto} from "/system/core.mjs"
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

    table tbody td:nth-child(1){width: 25px}
    table tbody td:nth-child(2){width: 450px}
    table tbody td:last-child{white-space: nowrap;}
    table tbody td{padding-top: 2px; padding-bottom: 0px;}

    table th:nth-child(2), table td:nth-child(2){padding-left: 0px;}
    h1{margin-top: 5px; margin-left: 5px; margin-bottom: 0px;}
  </style>  

  <action-bar>
      <action-bar-item id="new-btn" class="hidden">Upload file(s)</action-bar-item>
      <action-bar-item id="add-folder" class="hidden">Add folder</action-bar-item>

      <action-bar-item id="options-menu" class="hidden">
        <action-bar-menu label="Options">
          <button id="download-folder" title="Only downloads the files that are currently shown. It does not allow download of folders.">Download all files</button>
          <br>
          <button id="delete-all-btn" class="hidden">Delete all</button>
        </action-bar-menu>
      </action-bar-item>

  </action-bar>

  <div id="container">    
    <h1 id="folder-name"></h1>

    <table>
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
    this.deleteAll = this.deleteAll.bind(this);
    this.tabClick = this.tabClick.bind(this)
    
    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.uploadFile)
    this.shadowRoot.getElementById("add-folder").addEventListener("click", this.addFolder)
    this.shadowRoot.getElementById("download-folder").addEventListener("click", this.downloadFolder)
    this.shadowRoot.getElementById("delete-all-btn").addEventListener("click", this.deleteAll)
    this.shadowRoot.querySelector('table tbody').addEventListener("click", this.tabClick)

    if(state().path.startsWith("/folder/")){
      this.folderId = state().path.substring(8)
      if(!isNaN(this.folderId)) this.folderId = parseInt(this.folderId)
      else this.folderId = null;
    } else {
      this.folderPath = state().path.substring(6)
      if(!this.folderPath.startsWith("/")) this.folderPath = "/" + this.folderPath
      this.folderPath = decodeURI(this.folderPath);
      if(this.folderPath == "/mine")
        this.folderPath = `/${user?.id}`
    }

    userPermissions().then(permissions => {
      if(permissions.includes("file.upload")){
        this.shadowRoot.getElementById("new-btn").classList.remove("hidden")
      }
      if(permissions.includes("file.edit")){
        this.shadowRoot.getElementById("options-menu").classList.remove("hidden")
        this.shadowRoot.getElementById("add-folder").classList.remove("hidden")
        this.shadowRoot.getElementById("delete-all-btn").classList.remove("hidden")
      }
      this.shadowRoot.querySelector("action-bar").classList.toggle("hidden", !!!this.shadowRoot.querySelector("action-bar action-bar-item:not(.hidden)"))
    })
  }
  async refreshData(){
    this.folder = this.folderId ? await api.get(`file/${encodeURI(this.folderId)}`)
                                : await api.get(`file/path${encodeURI(this.folderPath)}`)
    if(!this.folder || this.folder.content.length < 1) return this.shadowRoot.querySelector('table tbody').innerHTML = ''
    this.shadowRoot.getElementById("folder-name").innerText = this.folder.parentPath == "/" && this.folder.name == "shared" ? "Shared files"
                                                            : this.folder.parentPath == "/" ? "My files"
                                                            : !this.folder.parentPath && !this.folder.name ? "Root"
                                                            : this.folder.name
    setPageTitle(!this.folder.parentPath ? "Files" : this.folder.name)
    this.shadowRoot.querySelector('table tbody').innerHTML = this.folder.content.sort((a, b) => {
      return a.type == b.type ? (a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1)
                              : a.type == "folder" ? -1 : 1
    }).map(f => `
        <tr class="result ${f.type}" data-id="${f.id}" data-name="${f.name}">
          <td><img style="width: 20px;" src="/img/${f.type == "folder" ? "folder.svg" : "file.png"}"></td>
          <td><field-ref ref="${f.type == "folder" ? (this.folderId ? `/folder/${f.id}` : `/files${(f.parentPath&&f.parentPath!="/") ? encodeURI(f.parentPath):""}/${encodeURI(f.name)}`) : `/file/${f.id}`}">${f.name}</field-ref></td>
          <td>
            <img title="Show info" class="info iconbtn" src="/img/info.png">
            <img title="Edit" class="edit iconbtn" src="/img/edit.ico">
            <img title="Delete" class="delete iconbtn" src="/img/delete.png">
          </td>
        </tr>
      `).join("");
  }

  async uploadFile(){
    let dialog = this.shadowRoot.querySelector("#new-dialog")
    uploadNewFile(dialog, {folder: this.folder, tags: [], callback: this.refreshData})
  }

  addFolder(){
    if(this.shadowRoot.getElementById("add-folder").hasAttribute("disabled")) return;
    if(!this.folder) return;

    let dialog = this.shadowRoot.getElementById("add-folder-dialog")
    
    showDialog(dialog, {
      show: () => this.shadowRoot.getElementById("add-name").focus(),
      ok: async (val) => {
        await api.post(`file/${this.folder.id}/folders`, val)
        this.refreshData()
      },
      validate: (val) => 
          !val.name ? "Please fill out name"
        : true,
      values: () => {return {
        name: this.shadowRoot.getElementById("add-name").value
      }},
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  async downloadFolder(){
    if(typeof window.showSaveFilePicker === "undefined") {
      let {token} = await api.get("me/token")
      window.open(`${apiURL()}/file/query/dl?filter=folder:${this.folder.id}&token=${token}`)
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
    await api.del(`file/query?filter=folder:${this.folder.id}`)
    this.refreshData()
  }

  async tabClick(e){
    if(e.target.tagName != "IMG") return;
    let tr = e.target.closest("tr");
    let id = tr.getAttribute("data-id")
    let name = tr.getAttribute("data-name")
    if(e.target.classList.contains("delete")){
      if(!await confirmDialog(`Are you sure that you want to delete ${tr.classList.contains("folder") ? "folder" : "file"} ${name}?`)) return;
      await api.del(`file/${id}`)
      this.refreshData()
    } else if(e.target.classList.contains("edit")){
      this.editRowClicked(e.target, tr, id)
    } else if(e.target.classList.contains("info")){
      goto(`/file/${id}`)
    }
  }

  editRowClicked(img, tr, id){
    let tdName = tr.querySelector("td:nth-child(2)")
    let tdFilter = tr.querySelector("td:nth-child(4)")
    let tdTags = tr.querySelector("td:nth-child(5)")
    let fileObj = this.folder.content.find(t => t.id == id)

    if(tr.hasAttribute("edit-mode")){
      tr.removeAttribute("edit-mode")

      fileObj.name = tdName.querySelector("field-edit").getValue()
      tdName.innerHTML = `<field-ref ref="${fileObj.type == "folder" ? `/files${(fileObj.parentPath&&fileObj.parentPath!="/") ? encodeURI(fileObj.parentPath):""}/${encodeURI(fileObj.name)}` : `/file/${fileObj.id}`}">${fileObj.name}</field-ref>`

      if(fileObj.type == "folder"){
        fileObj.filter = tdFilter.querySelector("field-edit").getValue()
        tdFilter.innerText = fileObj.filter
      }

      fileObj.tags = tdTags.querySelector("field-edit").getValue().split(",").map(t => t.trim())
      tdTags.innerHTML = fileObj.tags.join(", ")

      img.src = "/img/edit.ico"
    } else {
      tr.setAttribute("edit-mode", "true")

      tdName.innerHTML = `<field-edit type="text" value="${fileObj.name}" patch="file/${id}" field="name"></field-edit>`
      if(fileObj.type == "folder"){
        tdFilter.innerHTML = `<field-edit type="text" value="${fileObj.filter||""}" patch="file/${id}" field="filter"></field-edit>`
      }
      tdTags.innerHTML = `<field-edit type="text" value="${fileObj.tags.join(", ")}" patch="file/${id}" field="tags"></field-edit>`
      img.src = "/img/cancel.svg"
    }
  }

  connectedCallback() {
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

export async function uploadNewFile(dialog, {tags = [], folder = null, callback} = {}){
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
      let files;
      if(folder){
        await api.upload(`/file/folder/${folder.id}/upload?tags=${encodeURI(tags.join(","))}`, formData);
      } else {
        await api.upload(`/file/tag/${tags[0]}/upload`, formData);
      }
      if(tags.length > 1){
        for(let f of files){
          await api.patch(`file/${f.id}`, {tags})
        }
      }
      if(typeof callback === "function") 
        callback(val);
    },
    validate: (val) => 
        !val.tag && !folder ? "Please fill out tag"
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