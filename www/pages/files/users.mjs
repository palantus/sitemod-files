const elementName = 'files-usage-page'

import api from "../../system/api.mjs"
import "../../components/field-edit.mjs"
import "../../components/field-list.mjs"
import {on, off} from "../../system/events.mjs"
import { sizeToNameMB } from "../file.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='../css/global.css'>
  <link rel='stylesheet' href='../css/searchresults.css'>
  <style>
    #container{
        padding: 10px;
        position: relative;
    }
    field-list{
      width: 600px;
    }
    collapsible-card > div{
      padding: 10px;
    }
    collapsible-card{
      margin-bottom: 15px;
      display: block;
    }
  </style>  

  <div id="container">

    <h1>User files</h1>

    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Usage</th>
          <th>Quota</th>
        </tr>
      </thead>
      <tbody id="usage">
      </tbody>
    </table>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
  }

  async refreshData(){

    let users = await api.get("files/setup/users")

    this.shadowRoot.getElementById("usage").innerHTML = users.sort((a, b) => a.usageMB < b.usageMB ? 1 : a.usageMB > b.usageMB ? -1 : a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)
                                                             .map(user => `
      <tr class="result">
        <td><field-ref ref="/setup/users/${user.id}">${user.name}</field-ref></td>
        <td>${user.usageMB ? sizeToNameMB(user.usageMB) : "None"}</td>
        <td>${user.quotaMB === null ? "" : sizeToNameMB(user.quotaMB)}</td>
      </tr>
    `).join("")

    this.shadowRoot.querySelectorAll("#setup-list field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `files/setup`));
  }

  connectedCallback() {
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}