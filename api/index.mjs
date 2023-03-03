import file from './routes/file.mjs';
import setup from './routes/setup.mjs';

import filesQL from "./graphql/files.mjs";

export default (app, fields) => {
  
  file(app);
  setup(app);
	
  //GraphQL
  filesQL.registerQueries(fields)

  return app
}