import file from './routes/file.mjs';
import filesource from './routes/filesource.mjs';

import filesQL from "./graphql/files.mjs";

export default (app, fields) => {
  
  file(app);
  filesource(app)
	
  //GraphQL
  filesQL.registerQueries(fields)

  return app
}