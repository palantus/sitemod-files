import file from './routes/file.mjs';
import filesource from './routes/filesource.mjs';

export default (app) => {
  
  file(app);
  filesource(app)
	
  return app
}