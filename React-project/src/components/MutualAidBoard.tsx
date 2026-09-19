import React, { useState } from 'react';
import { Plus, CheckCircle2, Package, Droplet, Wrench, ShieldCheck, Truck, HelpCircle } from 'lucide-react';
import type { Need, NeedCategory, User } from '../types';
import { createNeed, claimNeed } from '../api';

interface MutualAidBoardProps {
  incidentId: number;
  needs: Need[];
  currentUser: User;
  onNeedCreated: (need: Need) => void;
  onNeedClaimed: (updatedNeed: Need) => void;
}

export const MutualAidBoard: React.FC<MutualAidBoardProps> = ({
  incidentId,
  needs,
  currentUser,
  onNeedCreated,
  onNeedClaimed,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState(25);
  const [category, setCategory] = useState<NeedCategory>('WATER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimQuantities, setClaimQuantities] = useState<{ [needId: number]: number }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isCoordinator = currentUser.role === 'COORDINATOR';
  const isVolunteer = currentUser.role === 'VOLUNTEER' || currentUser.role === 'ECO_CLUB';

  const handleCreateNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || quantity <= 0) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      const created = await createNeed(incidentId, {
        title,
        quantity,
        category,
        postedBy: currentUser.name,
      });
      onNeedCreated(created);
      setTitle('');
      setQuantity(25);
      setShowCreateForm(false);
    } catch (err: any) {
      setFormError(err.message || 'Erreur création besoin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async (need: Need) => {
    const requested = claimQuantities[need.id] || 1;
    const remaining = need.quantity - need.quantityClaimed;

    if (requested <= 0 || requested > remaining) {
      alert(`Quantité invalide ! Vous ne pouvez réclamer qu'entre 1 et ${remaining}.`);
      return;
    }

    try {
      await claimNeed(need.id, {
        userId: currentUser.id,
        userName: currentUser.name,
        quantity: requested,
      });
      // Update locally while WS message also updates
      onNeedClaimed({
        ...need,
        quantityClaimed: need.quantityClaimed + requested,
        status: (need.quantityClaimed + requested >= need.quantity) ? 'FULFILLED' : 'OPEN',
      });
      setClaimQuantities({ ...claimQuantities, [need.id]: 1 });
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la réclamation');
    }
  };

  const getCategoryIcon = (cat: NeedCategory) => {
    switch (cat) {
      case 'WATER': return <Droplet size={16} className="text-blue" />;
      case 'TOOLS': return <Wrench size={16} className="text-amber" />;
      case 'SAFETY': return <ShieldCheck size={16} className="text-green" />;
      case 'TRANSPORT': return <Truck size={16} className="text-purple" />;
      default: return <HelpCircle size={16} className="text-gray" />;
    }
  };

  return (
    <div className="aid-board-container">
      <div className="aid-board-header">
        <div>
          <h3>Entraide Communautaire & Mobilisation (Incident #{incidentId})</h3>
          <p className="subtitle">
            Centralisation des besoins logistiques d'urgence pour la population et les secouristes
          </p>
        </div>

        {isCoordinator && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus size={16} />
            <span>{showCreateForm ? 'Fermer le formulaire' : 'Publier un besoin'}</span>
          </button>
        )}
      </div>

      {formError && <div className="alert-box alert-error mb-3">{formError}</div>}

      {/* Coordinator Need Form */}
      {showCreateForm && (
        <form className="need-form-card" onSubmit={handleCreateNeed}>
          <h4>Nouveau besoin d'urgence</h4>
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Description du matériel ou ressource :</label>
              <input
                type="text"
                placeholder="Ex: 50 masques filtrants, 20 pelles, 100L carburant..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group flex-1">
              <label>Catégorie :</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as NeedCategory)}>
                <option value="WATER">Eau & Ravitaillement</option>
                <option value="TOOLS">Outils & Pare-feu</option>
                <option value="SAFETY">Sécurité & Masques</option>
                <option value="TRANSPORT">Véhicules & Transport</option>
                <option value="OTHER">Autre Soutien</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>Quantité totale requise :</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Publication...' : 'Diffuser le besoin aux bénévoles'}
            </button>
          </div>
        </form>
      )}

      {/* Needs Grid */}
      <div className="needs-grid">
        {needs.length === 0 ? (
          <div className="empty-needs">
            <Package size={36} className="icon-muted" />
            <p>Aucun besoin logistique publié pour cet incident.</p>
          </div>
        ) : (
          needs.map((need) => {
            const pct = Math.min(100, Math.round((need.quantityClaimed / need.quantity) * 100));
            const remaining = need.quantity - need.quantityClaimed;
            const currentClaimQty = claimQuantities[need.id] || Math.min(5, Math.max(1, remaining));

            return (
              <div key={need.id} className={`need-card ${need.status === 'FULFILLED' ? 'card-fulfilled' : ''}`}>
                <div className="need-card-top">
                  <div className="need-category-tag">
                    {getCategoryIcon(need.category)}
                    <span>{need.category}</span>
                  </div>
                  <span className={`need-status-tag ${need.status.toLowerCase()}`}>
                    {need.status === 'FULFILLED' ? 'POURVU (100%)' : `RESTE : ${remaining}`}
                  </span>
                </div>

                <h4 className="need-title">{need.title}</h4>

                {/* Progress Bar */}
                <div className="need-progress-wrap">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="progress-labels">
                    <span>{need.quantityClaimed} fournis</span>
                    <span className="font-bold">{pct}%</span>
                    <span>Objectif : {need.quantity}</span>
                  </div>
                </div>

                <div className="need-footer">
                  <span className="posted-by">Par : {need.postedBy}</span>

                  {/* Volunteer Claim Section */}
                  {need.status === 'OPEN' && (
                    <div className="claim-action-wrap">
                      {isVolunteer ? (
                        <div className="claim-controls">
                          <input
                            type="number"
                            min="1"
                            max={remaining}
                            value={currentClaimQty}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(remaining, parseInt(e.target.value) || 1));
                              setClaimQuantities({ ...claimQuantities, [need.id]: val });
                            }}
                            className="claim-input"
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleClaim(need)}
                          >
                            Fournir
                          </button>
                        </div>
                      ) : (
                        <span className="hint-text">Connectez-vous en Bénévole pour fournir</span>
                      )}
                    </div>
                  )}

                  {need.status === 'FULFILLED' && (
                    <span className="badge-fulfilled-check">
                      <CheckCircle2 size={16} /> Besoin satisfait
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
