from flask import Flask, request, jsonify
from barcode_lookup import lookup_barcode
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/barcode-lookup', methods=['POST'])
def barcode_lookup_api():
    data = request.get_json()
    barcode = data.get('barcode')
    if not barcode:
        return jsonify({'error': 'No barcode provided'}), 400
    try:
        result = lookup_barcode(barcode)
        if result:
            return jsonify(result)
        else:
            return jsonify({'error': 'Product not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True) 