import file from './routes/file.mjs';

import filesQL from "./graphql/files.mjs";

export default (app, fields) => {
  
  file(app);
	
  //GraphQL
  filesQL.registerQueries(fields)

  return app
}