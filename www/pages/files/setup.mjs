const elementName = 'files-setup-page'

import api from "../../system/api.mjs"
import "../../components/field-edit.mjs"
import "../../components/field-list.mjs"
import "../../components/collapsible-card.mjs"
import {on, off} from "../../system/events.mjs"
import {goto, stylesheets} from "../../system/core.mjs"

const template = document.createElement('template');
template.innerHTML = `
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

    <h1>Files setup</h1>

    <collapsible-card open>
      <span slot="title">Common</span>
      <div>
        <field-list labels-pct="30" id="setup-list">
          <field-edit type="checkbox" label="Only ASCII headers" id="onlyASCIIHeaders" title="Workaround for an issue on the Azure platform, where unicode characters cannot be present in content-disposition headers. Will be stripped of non-ASCII characters, if this is set"></field-edit>
        </field-list>
      </div>
    </collapsible-card>

    <collapsible-card open>
      <span slot="title">Quota</span>
      <div>
        <p>The following is the total size limit of all files for a given user role. If a user has more than one role, the role with the largest (defined) quota counts. If the user is not in a role with a quota, there is no limit.</p>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Quota (MB)</th>
            </tr>
          </thead>
          <tbody id="quota">
          </tbody>
        </table>
        <br>
        <button class="styled" id="user-usage-btn">View user usage</button>
      </div>
    </collapsible-card>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' })
        .adoptedStyleSheets = [stylesheets.global, stylesheets.searchresults];
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    
    this.shadowRoot.getElementById("user-usage-btn").addEventListener("click", () => goto("/files/setup/users"))
  }

  async refreshData(){

    let setup = await api.get("files/setup")

    this.shadowRoot.getElementById("onlyASCIIHeaders").setAttribute("value", !!setup.onlyASCIIHeaders)
    this.shadowRoot.getElementById("quota").innerHTML = setup.roles.map(role => `
      <tr class="result">
        <td>${role.id}</td>
        <td><field-edit type="number" field="quota" patch="files/setup/role/${role.id}" value="${role.quota}"></field-edit></td>
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