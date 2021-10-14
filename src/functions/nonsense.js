import Busboy from 'busboy';
import fetch from 'node-fetch';

const HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Origin': '*',
};

const VALID_MIMETYPES = [
  'application/octet-stream',
  'application/x-rar-compressed',
  'application/x-zip-compressed',
  'application/zip',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'multipart/x-zip',
];

const parse = (event) => {
  return new Promise((resolve, reject) => {
    const fields = {};
    const busboy = new Busboy({
      headers: event.headers,
      limits: {
        files: 5,
        fileSize: 10 * 1_024 * 1_024,
      },
    });

    busboy.on(
      'file',
      (fieldname, filestream, filename, transferEncoding, mimeType) => {
        if (!VALID_MIMETYPES.includes(mimeType)) {
          reject(new Error(`INVALID_MIMETYPE: ${mimeType}`));
        }
        filestream.on('limit', () => reject(new Error('FILE_TOO_LARGE')));
        filestream.on('data', (data) => {
          fields[fieldname] = fields[fieldname] ?? [];
          fields[fieldname].push({
            content: data,
            filename,
            type: mimeType,
          });
        });
      }
    );

    busboy.on('field', (fieldName, value) => {
      fields[fieldName] = value;
    });

    busboy.on('filesLimit', () => reject(new Error('TOO_MANY_FILES')));
    busboy.on('finish', () => {
      resolve(fields);
    });

    busboy.write(event.body);
  });
};

const handler = async (event) => {
  try {
    const { attachments, email, name } = await parse(event);

    const response = await fetch('https://thatcopy.pw/catapi/rest/', {
      method: 'GET',
    });

    const cat = await response.json();

    return {
      body: JSON.stringify({
        cat,
        form: {
          attachments: attachments.length ?? 0,
          email,
          name,
        },
      }),
      headers: HEADERS,
      statusCode: 200,
    };
  } catch {
    return {
      headers: HEADERS,
      statusCode: 500,
    };
  }
};

export { handler };
