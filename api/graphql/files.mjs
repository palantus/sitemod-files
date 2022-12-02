import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLBoolean,
  GraphQLUnionType
} from 'graphql'
import { ifPermission, ifPermissionThrow } from "../../../../services/auth.mjs"
import File from '../../models/file.mjs'
import Folder from '../../models/folder.mjs'
import {UserType} from '../../../../api/graphql/user.mjs'
import FileOrFolder from '../../models/fileorfolder.mjs'

/*
Sample query:
{
  folder(id: 80298){
    id, name,
    content{
      ...on FileType{
        id, name, type
      },
      ...on FolderType{
        id, name, type
      }
    }
  }
}
*/

/*

  toObj(user, shareKey) {
    return {
      links: {
        download: `${global.sitecore.apiURL}/file/dl/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?${shareKey ? `shareKey=${shareKey}` : `token=${userService.getTempAuthToken(user)}`}`,
        raw: `${global.sitecore.apiURL}/file/raw/${this._id}${this.name ? `/${encodeURI(this.name)}` : ''}?token=${userService.getTempAuthToken(user)}`,
      }
    }
  */

export const FileType = new GraphQLObjectType({
  name: 'FileType',
  description: 'This represents a file',
  fields: () => ({
    id: { type: GraphQLNonNull(GraphQLInt), resolve: file => file._id },
    name: {type: GraphQLNonNull(GraphQLString)},
    type: {type: GraphQLNonNull(GraphQLString), resolve: () => "file"},
    parentPath: {type: GraphQLNonNull(GraphQLString)},
    rights: {type: GraphQLNonNull(GraphQLString), resolve: (file, args, context) => file.rights(context.user, context.shareKey)},
    created: {type: GraphQLString, resolve: f => f.timestamp || null},
    modified: {type: GraphQLString},
    expirationDate: {type: GraphQLString, resolve: f => f.expire || null},
    mime: {type: GraphQLString},
    mimeType: {type: GraphQLString},
    mimeSubType: {type: GraphQLString},
    hash: {type: GraphQLString},
    size: {type: GraphQLInt},
    owner: {type: UserType},
    tags: {type: GraphQLList(GraphQLString), resolve: f => f.userTags},
    links: {type: GraphQLNonNull(FileLinkType), resolve: (f, args, context) => f.getLinks(context.user, context.shareKey)}
  })
})

export const FolderType = new GraphQLObjectType({
  name: 'FolderType',
  description: 'This represents a folder',
  fields: () => ({
    id: { type: GraphQLNonNull(GraphQLInt), resolve: file => file._id },
    name: {type: GraphQLNonNull(GraphQLString)},
    type: {type: GraphQLNonNull(GraphQLString), resolve: () => "folder"},
    content: {type: GraphQLNonNull(GraphQLList(FileOrFolderType)), resolve: (folder, args, context) => folder.accessibleContent(context.user, context.shareKey)},
    parentPath: {type: GraphQLNonNull(GraphQLString)},
    rights: {type: GraphQLNonNull(GraphQLString), resolve: (file, args, context) => file.rights(context.user, context.shareKey)},
    isSymbolic: {type: GraphQLNonNull(GraphQLBoolean), resolve: folder => folder.isSymbolicLink()},
    created: {type: GraphQLString, resolve: f => f.timestamp || null},
    owner: {type: UserType},
    tags: {type: GraphQLList(GraphQLString), resolve: f => f.userTags},
  })
})

export const FileOrFolderType = new GraphQLUnionType({
  name: "FileOrFolder",
  types: [FileType, FolderType],
  resolveType: value => value instanceof File ? FileType : value instanceof Folder ? FolderType : null
})

export const FileLinkType = new GraphQLObjectType({
  name: 'FileLinkType',
  description: 'This represents a link',
  fields: () => ({
    download: {type: GraphQLNonNull(GraphQLString)},
    raw: {type: GraphQLNonNull(GraphQLString)},
  })
})

export default {
  registerQueries: (fields) => {
    fields.file = {
      type: FileType,
      args: {
        id: { type: GraphQLInt }
      },
      description: "Get a specific file",
      resolve: (parent, args, context) => {
        ifPermissionThrow(context, "file.read", null)
        let file = File.lookup(args.id)
        if(!file) return null;
        if(!file.hasAccess(context.user, 'r', context.shareKey)) throw "You do not have access to this file"
        return file
      }
    }
    fields.folder = {
      type: FolderType,
      args: {
        id: { type: GraphQLInt },
        path: {type: GraphQLString}
      },
      description: "Get a specific folder",
      resolve: (parent, args, context) => {
        ifPermissionThrow(context, "file.read", null)
        if(args.path) Folder.userRoot(context.user) //Will create user root if missing
        let folder = args.id ? Folder.lookup(args.id) : args.path ? Folder.lookupByPath(args.path) : null;
        if(!folder) return null;
        if(!folder.hasAccess(context.user, 'r', context.shareKey)) throw "You do not have access to this folder"
        return folder
      }
    }

    fields.fileOrFolder = {
      type: FileOrFolderType,
      args: {
        id: { type: GraphQLInt }
      },
      description: "Get a specific file or folder",
      resolve: (parent, args, context) => {
        ifPermissionThrow(context, "file.read", null)
        let ff = FileOrFolder.lookup(args.id);
        if(!ff) return null;
        if(!ff.hasAccess(context.user, 'r', context.shareKey)) throw "You do not have access to this file or folder"
        return ff.toType()
      }
    }
  }
}