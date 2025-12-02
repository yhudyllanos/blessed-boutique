import React, { useState, useEffect } from 'react';
import { GitHubService } from '../services/github';
import styles from './Admin.module.css';

const Admin = () => {
    // Authentication - Change the password below to your own secure password
    const _0x4a2b = 'Blessed@Boutique#2024!'; // Your admin password - CHANGE THIS!
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');

    const [token, setToken] = useState(localStorage.getItem('github_token') || '');
    const [repo, setRepo] = useState(localStorage.getItem('github_repo') || '');
    const [products, setProducts] = useState([]);
    const [sha, setSha] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const [newProduct, setNewProduct] = useState({
        id: '',
        name: '',
        category: 'Vestidos',
        price: '',
        sizes: [],
        description: '',
        images: [],
        status: 'available',
        measurements: { bust: '', waist: '', length: '' }
    });

    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    useEffect(() => {
        // Check if user is already authenticated
        const authStatus = localStorage.getItem('admin_authenticated');
        if (authStatus === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && token && repo) {
            loadProducts();
        }
    }, [isAuthenticated]);

    const loadProducts = async () => {
        if (!token || !repo) return;
        setLoading(true);
        setStatus('Cargando productos desde GitHub...');
        try {
            const [owner, repoName] = repo.split('/');
            const gh = new GitHubService(token, owner, repoName);
            const data = await gh.getProducts();
            setProducts(data.content);
            setSha(data.sha);
            setStatus('Productos cargados correctamente.');
        } catch (error) {
            console.error(error);
            setStatus('Error al cargar productos. Verifica tus credenciales.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (passwordInput === _0x4a2b) {
            setIsAuthenticated(true);
            localStorage.setItem('admin_authenticated', 'true');
            setLoginError('');
            setPasswordInput('');
        } else {
            setLoginError('Contraseña incorrecta. Intenta de nuevo.');
            setPasswordInput('');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('admin_authenticated');
        setProducts([]);
        setSha(null);
    };

    const handleSaveCredentials = () => {
        localStorage.setItem('github_token', token);
        localStorage.setItem('github_repo', repo);
        loadProducts();
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('measurements.')) {
            const measurementField = name.split('.')[1];
            setNewProduct(prev => ({
                ...prev,
                measurements: { ...prev.measurements, [measurementField]: value }
            }));
        } else {
            setNewProduct(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSizeChange = (size) => {
        setNewProduct(prev => {
            const sizes = prev.sizes.includes(size)
                ? prev.sizes.filter(s => s !== size)
                : [...prev.sizes, size];
            return { ...prev, sizes };
        });
    };

    const handleImageSelect = (e) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setImageFiles(files);

            // Create previews
            const previews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(previews);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token || !repo) return alert('Configura tus credenciales primero.');

        setLoading(true);
        setStatus('Subiendo imágenes y guardando...');

        try {
            const [owner, repoName] = repo.split('/');
            const gh = new GitHubService(token, owner, repoName);

            let imageUrls = [...newProduct.images]; // Keep existing URLs if any (e.g. manual input)

            if (imageFiles.length > 0) {
                for (let i = 0; i < imageFiles.length; i++) {
                    setStatus(`Subiendo imagen ${i + 1} de ${imageFiles.length}...`);
                    const url = await gh.uploadImage(imageFiles[i]);
                    imageUrls.push(url);
                }
            }

            // If user pasted a URL in the text input, add it (assuming newProduct.images might handle manual entry too, but for now we just use the uploaded ones primarily or what was in state)
            // Actually, let's just use the uploaded ones + whatever was manually added if we add a manual input back.
            // For simplicity, we'll assume the user uses the file uploader OR we could add a text input for external URLs.
            // Let's stick to the file uploader as primary.

            const id = Date.now().toString();
            const productToAdd = {
                ...newProduct,
                id,
                images: imageUrls,
                price: parseFloat(newProduct.price)
            };

            const updatedProducts = [...products, productToAdd];

            setStatus('Actualizando base de datos...');
            const result = await gh.saveProducts(updatedProducts, sha);

            setProducts(updatedProducts);
            setSha(result.content.sha);

            // Reset form
            setNewProduct({
                id: '',
                name: '',
                category: 'Vestidos',
                price: '',
                sizes: [],
                description: '',
                images: [],
                status: 'available',
                measurements: { bust: '', waist: '', length: '' }
            });
            setImageFiles([]);
            setImagePreviews([]);
            setStatus('¡Producto guardado exitosamente!');
        } catch (error) {
            console.error(error);
            setStatus('Error al guardar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleProductStatus = async (productId) => {
        if (!confirm('¿Cambiar estado del producto?')) return;

        const updatedProducts = products.map(p => {
            if (p.id === productId) {
                return { ...p, status: p.status === 'sold' ? 'available' : 'sold' };
            }
            return p;
        });

        await saveChanges(updatedProducts);
    };

    const deleteProduct = async (productId) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        const updatedProducts = products.filter(p => p.id !== productId);
        await saveChanges(updatedProducts);
    };

    const saveChanges = async (newProductsList) => {
        setLoading(true);
        setStatus('Guardando cambios...');
        try {
            const [owner, repoName] = repo.split('/');
            const gh = new GitHubService(token, owner, repoName);
            const result = await gh.saveProducts(newProductsList, sha);
            setProducts(newProductsList);
            setSha(result.content.sha);
            setStatus('Cambios guardados.');
        } catch (error) {
            setStatus('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="container">
                <div className={styles.loginContainer}>
                    <div className={styles.loginBox}>
                        <h1 className={styles.loginTitle}>🔐 Acceso Administrativo</h1>
                        <p className={styles.loginSubtitle}>Ingresa la contraseña para continuar</p>
                        <form onSubmit={handleLogin} className={styles.loginForm}>
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className={styles.loginInput}
                                autoFocus
                            />
                            {loginError && <p className={styles.loginError}>{loginError}</p>}
                            <button type="submit" className="btn btn-primary">
                                Iniciar Sesión
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className={styles.headerRow}>
                <h1 className={styles.title}>Panel de Administración Automático</h1>
                <button onClick={handleLogout} className="btn btn-outline" style={{ fontSize: '0.9rem' }}>
                    Cerrar Sesión
                </button>
            </div>

            <div className={styles.configSection}>
                <h3>Configuración de GitHub</h3>
                <div className={styles.row}>
                    <input
                        type="password"
                        placeholder="GitHub Token (ghp_...)"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className={styles.input}
                    />
                    <input
                        type="text"
                        placeholder="Usuario/Repositorio (ej: juan/tienda)"
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        className={styles.input}
                    />
                    <button onClick={handleSaveCredentials} className="btn btn-outline">Conectar</button>
                </div>
                {status && <p className={styles.status}>{status}</p>}
            </div>

            {loading && <div className={styles.loader}>Procesando... Por favor espera.</div>}

            <div className={styles.grid}>
                <div className={styles.formSection}>
                    <h2>Agregar Nuevo Producto</h2>
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label>Nombre</label>
                            <input type="text" name="name" value={newProduct.name} onChange={handleInputChange} required />
                        </div>

                        <div className={styles.row}>
                            <div className={styles.formGroup}>
                                <label>Categoría</label>
                                <select name="category" value={newProduct.category} onChange={handleInputChange}>
                                    <option value="Vestidos">Vestidos</option>
                                    <option value="Faldas">Faldas</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Precio</label>
                                <input type="number" name="price" value={newProduct.price} onChange={handleInputChange} required />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Imágenes (Selecciona varias)</label>
                            <input type="file" accept="image/*" multiple onChange={handleImageSelect} />
                            <div className={styles.previewContainer}>
                                {imagePreviews.map((src, index) => (
                                    <img key={index} src={src} alt="Preview" className={styles.previewThumb} />
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Descripción</label>
                            <textarea name="description" value={newProduct.description} onChange={handleInputChange} required />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Tallas</label>
                            <div className={styles.checkboxGroup}>
                                {['S', 'Sm', 'M', 'Ml', 'L', 'XL'].map(size => (
                                    <label key={size} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={newProduct.sizes.includes(size)}
                                            onChange={() => handleSizeChange(size)}
                                        />
                                        {size}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Medidas</label>
                            <div className={styles.row}>
                                <input type="text" name="measurements.bust" placeholder="Busto" value={newProduct.measurements.bust} onChange={handleInputChange} />
                                <input type="text" name="measurements.waist" placeholder="Cintura" value={newProduct.measurements.waist} onChange={handleInputChange} />
                                <input type="text" name="measurements.length" placeholder="Largo" value={newProduct.measurements.length} onChange={handleInputChange} />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Producto'}
                        </button>
                    </form>
                </div>

                <div className={styles.inventorySection}>
                    <h2>Inventario ({products.length})</h2>
                    <div className={styles.productList}>
                        {products.map(p => (
                            <div key={p.id} className={styles.productItem}>
                                <img src={p.images && p.images[0]} alt={p.name} className={styles.thumb} />
                                <div className={styles.productDetails}>
                                    <strong>{p.name}</strong>
                                    <span>${p.price}</span>
                                    <span className={p.status === 'sold' ? styles.soldBadge : styles.availableBadge}>
                                        {p.status === 'sold' ? 'VENDIDO' : 'DISPONIBLE'}
                                    </span>
                                </div>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => toggleProductStatus(p.id)}
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                                    >
                                        {p.status === 'sold' ? 'Marcar Disp.' : 'Marcar Vendido'}
                                    </button>
                                    <button
                                        onClick={() => deleteProduct(p.id)}
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.8rem', padding: '5px 10px', borderColor: 'red', color: 'red' }}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Admin;
